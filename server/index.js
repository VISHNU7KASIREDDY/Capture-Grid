const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { initGrid, getGridSnapshot, handleCapture } = require('./grid');

const PORT = process.env.PORT || 3001;
  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const COLOR_PALETTE = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#F7B731',
  '#DDA0DD',
  '#98D8C8',
  '#A29BFE',
  '#FD79A8',
  '#00B894',
  '#E17055',
  '#6C5CE7',
];

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const users = new Map();

const knownUsers = new Map();

initGrid();

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.get('/api/grid', (_req, res) => {
  res.json(getGridSnapshot());
});

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, connectedUsers: users.size });
});

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

io.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('join', ({ name, userId: existingId }, ack) => {
    const userId = (existingId && knownUsers.has(existingId)) ? existingId : (existingId || uuidv4());
    currentUserId = userId;

    let color;
    const isKnown = knownUsers.has(userId);

    if (isKnown) {
      color = knownUsers.get(userId).color;
      knownUsers.get(userId).name = name;
    } else {
      color = assignColor();
      knownUsers.set(userId, { name, color });
    }

    users.set(userId, {
      name,
      color,
      socketId: socket.id,
      lastActionAt: 0,
    });

    const you = { id: userId, name, color };
    const grid = getGridSnapshot();
    const names = getNamesMap();

    if (typeof ack === 'function') {
      ack({ you, grid, names });
    }

    io.emit('presence_update', { onlineCount: getOnlineCount(), names: getNamesMap() });

    console.log(`[join] ${name} (${userId.slice(0, 8)}) ${isKnown ? 're-' : ''}connected. Online: ${getOnlineCount()}`);
  });

  socket.on('capture', ({ blockId }) => {
    if (!currentUserId) return;

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
      console.log(`[disconnect] ${currentUserId.slice(0, 8)} left. Online: ${getOnlineCount()}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🟢 Block Capture server running on http://localhost:${PORT}`);
  console.log(`   Grid: 20×20 (400 blocks) initialized in memory`);
  console.log(`   Accepting connections from: ${CLIENT_ORIGIN}`);
});
