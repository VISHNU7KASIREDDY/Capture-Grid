require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { initGrid, getGridSnapshot, handleCapture } = require('./grid');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Support comma-separated origins for multi-domain deployments
// e.g. CLIENT_ORIGIN=https://app.com,https://www.app.com
const rawOrigins = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

const logger = {
  info:  (msg) => console.log(`[INFO]  ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn:  (msg) => console.warn(`[WARN]  ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => LOG_LEVEL === 'debug' && console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`),
};

const COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F7B731',
  '#DDA0DD', '#98D8C8', '#A29BFE', '#FD79A8', '#00B894',
  '#E17055', '#6C5CE7',
];

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const users = new Map();
const knownUsers = new Map();

initGrid();

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// Security headers (safe defaults; CSP disabled so Socket.io polling works)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — restrict to declared origins only
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools (curl, health checkers) that send no Origin
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked request from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '16kb' }));

// Rate-limit REST endpoints (not Socket.io — that's handled in game logic)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,               // 60 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// HTTP server + Socket.io
// ---------------------------------------------------------------------------

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  // Use both transports; polling lets clients behind restrictive proxies connect
  transports: ['websocket', 'polling'],
});

// ---------------------------------------------------------------------------
// REST routes
// ---------------------------------------------------------------------------

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, connectedUsers: users.size, env: NODE_ENV });
});

app.get('/api/grid', (_req, res) => {
  res.json(getGridSnapshot());
});

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, connectedUsers: users.size });
});

// ---------------------------------------------------------------------------
// Socket helpers
// ---------------------------------------------------------------------------

function getOnlineCount() {
  return users.size;
}

function getNamesMap() {
  const names = {};
  for (const [id, u] of knownUsers.entries()) {
    names[id] = u.name;
  }
  return names;
}

function assignColor() {
  const usedColors = new Set(Array.from(knownUsers.values()).map((u) => u.color));
  return (
    COLOR_PALETTE.find((c) => !usedColors.has(c)) ||
    COLOR_PALETTE[knownUsers.size % COLOR_PALETTE.length]
  );
}

// ---------------------------------------------------------------------------
// Socket.io events
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('join', ({ name, userId: existingId }, ack) => {
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 24) : '';
    if (!trimmed) return;

    const userId =
      existingId && knownUsers.has(existingId) ? existingId : existingId || uuidv4();
    currentUserId = userId;

    let color;
    const isKnown = knownUsers.has(userId);

    if (isKnown) {
      color = knownUsers.get(userId).color;
      knownUsers.get(userId).name = trimmed;
    } else {
      color = assignColor();
      knownUsers.set(userId, { name: trimmed, color });
    }

    users.set(userId, {
      name: trimmed,
      color,
      socketId: socket.id,
      lastActionAt: 0,
    });

    const you = { id: userId, name: trimmed, color };
    const grid = getGridSnapshot();
    const names = getNamesMap();

    if (typeof ack === 'function') {
      ack({ you, grid, names });
    }

    io.emit('presence_update', { onlineCount: getOnlineCount(), names: getNamesMap() });
    logger.info(`${trimmed} (${userId.slice(0, 8)}) ${isKnown ? 're-' : ''}connected. Online: ${getOnlineCount()}`);
  });

  socket.on('capture', ({ blockId }) => {
    if (!currentUserId) return;
    if (typeof blockId !== 'string') return;

    const result = handleCapture(currentUserId, blockId, users);

    if (result.rejected) {
      socket.emit('cooldown_rejected', {
        blockId,
        remainingMs: result.remainingMs,
      });
    } else {
      io.emit('block_updated', {
        blockId: result.blockId,
        owner: result.block.owner,
        color: result.block.color,
        capturedAt: result.block.capturedAt,
      });
    }
  });

  socket.on('disconnect', () => {
    if (currentUserId) {
      users.delete(currentUserId);
      io.emit('presence_update', { onlineCount: getOnlineCount(), names: getNamesMap() });
      logger.info(`${currentUserId.slice(0, 8)} left. Online: ${getOnlineCount()}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  logger.info(`🟢 Block Capture server running on port ${PORT}`);
  logger.info(`   Environment : ${NODE_ENV}`);
  logger.info(`   CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  logger.info(`   Grid        : 20×20 (400 blocks) initialized`);
  logger.debug(`   Log level   : ${LOG_LEVEL}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully…`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting.');
    process.exit(0);
  });

  // Force-exit after 10 s if connections don't drain
  setTimeout(() => {
    logger.warn('Forced exit after 10 s timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});
