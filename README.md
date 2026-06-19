# Block Capture 🎮

A real-time, multiplayer block-claiming game built on a shared 20×20 grid. Click to capture, release, or steal blocks — every action is instantly visible to every connected player via WebSockets. No login. No database. Just play.

**Live instantly.** See your moves and your rivals' moves appear on the grid in real-time, with a 3-second action cooldown to keep things balanced.

---

## 🌟 Features

- **Real-time Multiplayer** – WebSocket-powered synchronization across all connected players
- **No Auth Required** – Play instantly; UUID-based identity persists across refreshes
- **Simple Mechanics** – Capture unclaimed blocks, release your own, steal from rivals
- **Global Grid** – Single shared 20×20 grid; one game instance for all
- **Cooldown System** – 3-second per-action cooldown prevents spam, shows visual timer
- **Live Leaderboard** – Top 8 players by block count, updated in real-time
- **Responsive UI** – CSS Grid layout, smooth animations, mobile-friendly
- **Zero Database** – In-memory state; ideal for ephemeral multiplayer sessions

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ and **npm** 8+

### Installation & Running

```bash
# 1. Clone the repository
git clone https://github.com/VISHNU7KASIREDDY/Capture-Grid.git
cd Capture-Grid

# 2. Install all dependencies (root + server + client)
npm run install:all

# 3. Start both servers with one command
npm run dev
```

**Result:**
- **Client** → http://localhost:5173
- **Server** → http://localhost:3001

Open two browser tabs on http://localhost:5173 to see real-time synchronization in action.

### Individual Commands

```bash
# Start server only
cd server && npm start

# Start client only (from root)
cd client && npm run dev

# Install dependencies manually
npm install                    # root dependencies
cd server && npm install       # server dependencies
cd ../client && npm install    # client dependencies
```

---

## 🎮 How to Play

1. **Enter Your Name** – On first visit, a modal prompts for a display name. Subsequent visits auto-restore your identity.
2. **Capture a Block** – Click any unclaimed (white/light) block to claim it with your color.
3. **Release a Block** – Click your own block (colored with your shade) to release it back to unclaimed.
4. **Steal a Block** – Click another player's colored block to steal it instantly.
5. **Watch the Timer** – The cooldown ring at the top shows your 3-second countdown between actions.
6. **Check the Leaderboard** – The right sidebar shows the top 8 players by blocks captured.

### Game Rules

| Action | Requirement | Result |
|--------|-------------|--------|
| **Capture** | Block must be unclaimed | Block becomes yours, your color is applied |
| **Release** | Block must be yours | Block returns to unclaimed (white) |
| **Steal** | Block must belong to another player | Block is reassigned to you |
| **Cooldown** | Must wait 3 seconds since last action | Action rejected; timer shown |
| **Disconnect** | Player leaves the game | Blocks retain ownership; player disappears from leaderboard |

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite |
| **Styling** | Plain CSS, CSS Grid, CSS Animations |
| **Real-time Communication** | Socket.io (client + server) |
| **Backend** | Node.js + Express 4 |
| **State Management** | In-memory `Map` (no database) |
| **Identity** | UUID + `localStorage` (no auth system) |
| **Build Tool** | Vite |

### Design Philosophy

#### In-Memory State

Grid state and per-user cooldowns live in plain JavaScript `Map` objects on the server:

- **Simplicity.** No ORM, no migrations, no schema overhead.
- **Natural Serialization.** Node.js event loop is single-threaded; socket events are handled sequentially, so two near-simultaneous clicks on the same block are naturally serialized by arrival order — no explicit locks required.
- **Trade-off.** State is lost on process restart. For persistent gameplay, add Redis (see *Scaling* below).

#### No Authentication

The game requires instant play with zero friction:
- Each player gets a stable UUID stored in `localStorage`.
- Refresh or rejoin? Same UUID, same color, same block ownership.
- Auth would add complexity with zero gameplay benefit for a session toy.

#### Single Global Grid

- One shared 20×20 grid for every connected player.
- No rooms, lobbies, or instancing.
- Server logic remains trivially simple.
- Game is instantly joinable with no setup.

---

## 📁 Project Structure

```
Capture-Grid/
├── package.json                  Root manifest; scripts for install:all, dev
├── README.md                      This file
│
├── server/
│   ├── index.js                   Express + Socket.io server
│   │                              - join event handler
│   │                              - capture event handler
│   │                              - disconnect event handler
│   │                              - REST endpoints (/api/grid, /api/status)
│   │
│   ├── grid.js                    Grid state management & capture logic
│   │                              - initGrid() – Initialize 400 empty blocks
│   │                              - getGridSnapshot() – JSON snapshot
│   │                              - handleCapture() – Claim/release/steal logic
│   │                              - getBlockCounts() – Count blocks per player
│   │
│   └── package.json               Server dependencies (express, socket.io, uuid, cors)
│
├── client/
│   ├── package.json               Client dependencies (react, vite, socket.io-client)
│   ├── vite.config.js             Vite build configuration
│   ├── eslint.config.js           ESLint rules
│   ├── index.html                 HTML entry point
│   ├── README.md                  Client-specific notes
│   │
│   └── src/
│       ├── main.jsx               React DOM render entry point
│       ├── App.jsx                Top-level component
│       │                          - State: me, grid, players, cooldown, toast, etc.
│       │                          - Socket listeners for block_updated, cooldown_rejected, presence_update
│       │                          - Leaderboard derivation
│       │                          - Cooldown timer countdown
│       │
│       ├── Grid.jsx               Grid layout component (20×20 CSS Grid)
│       │                          - Maps blockIds to Block components
│       │                          - Pre-computes block IDs once on load
│       │
│       ├── Block.jsx              Individual block component
│       │                          - Click handler
│       │                          - Pop animation (classList toggle + reflow trick)
│       │                          - Owns/Claimed/Unclaimed states
│       │                          - Accessibility: role, aria-label, title
│       │
│       ├── NamePrompt.jsx         Modal dialog for name entry & join
│       │                          - Random name generator
│       │                          - LocalStorage save of userId & name
│       │                          - Socket.io join emission
│       │
│       ├── socket.js              Singleton socket.io-client instance
│       │                          - autoConnect: false (manual connection after name entry)
│       │
│       ├── App.css                (empty or minimal)
│       ├── styles.css             Main stylesheet
│       │                          - CSS variables (colors, spacing)
│       │                          - Grid layout
│       │                          - Animations (pop, shake, spin)
│       │                          - Modal, topbar, leaderboard, toast styles
│       │
│       ├── index.css              Global resets & CSS variables
│       │
│       └── assets/                (placeholder for future assets)
```

---

## 🔌 Socket.io Events Reference

### Client → Server

#### `join`
**Payload:**
```javascript
{
  name: string,              // Display name (1–24 chars)
  userId?: string            // Optional; existing UUID for reconnect
}
```
**Behavior:**
- Server checks if `userId` is known; restores color if yes
- Otherwise assigns next available palette color
- Stores in both `users` (online) and `knownUsers` (persistent)
- Returns `{ you, grid, names }` via callback
- Broadcasts `presence_update` to all clients

---

#### `capture`
**Payload:**
```javascript
{
  blockId: string            // e.g., "5-12"
}
```
**Behavior:**
- Server checks user's cooldown (3 seconds)
- If blocked: sends `cooldown_rejected` to requester only
- If allowed: claims, releases, or steals block
- Broadcasts `block_updated` to all clients

---

### Server → Client

#### `block_updated`
**Payload:**
```javascript
{
  blockId: string,          // e.g., "5-12"
  owner: string | null,     // userId or null
  color: string,            // CSS color or null
  capturedAt: number        // Timestamp or null
}
```
**Broadcast to:** All connected clients

---

#### `cooldown_rejected`
**Payload:**
```javascript
{
  blockId: string,
  remainingMs: number       // Milliseconds until user can act again
}
```
**Broadcast to:** Requesting socket only

---

#### `presence_update`
**Payload:**
```javascript
{
  onlineCount: number,      // Current count of online users
  names: object             // { userId: name, userId: name, ... }
}
```
**Broadcast to:** All connected clients

---

## 🌐 REST API Endpoints

### `GET /api/grid`

**Description:** Returns the full grid snapshot as JSON.

**Use Case:** Initial page load, polling fallback (if Socket.io fails).

**Response:**
```javascript
{
  "0-0": { owner: "uuid-1", color: "#FF6B6B", capturedAt: 1718791234567 },
  "0-1": { owner: null, color: null, capturedAt: null },
  // ... 400 total entries
}
```

---

### `GET /api/status`

**Description:** Health-check endpoint.

**Response:**
```javascript
{
  ok: true,
  connectedUsers: 5
}
```

---

## 🎨 Game Mechanics in Detail

### The Cooldown Algorithm

**Goal:** Prevent spam; allow ~20 actions per player per minute.

**Logic:**
1. On first `join`, set user's `lastActionAt = 0`
2. On `capture` event:
   - Calculate `elapsed = now - lastActionAt`
   - If `elapsed < 3000` ms, return `{ rejected: true, remainingMs: 3000 - elapsed }`
   - Otherwise, proceed with claim/release/steal and set `lastActionAt = now`

**Client Behavior:**
- On `cooldown_rejected`, show countdown timer
- Animation continues during cooldown; button is still clickable but requests are dropped
- Toast shows "⏱ Wait Xs before your next move"

---

### Block States

Each block is represented as:
```javascript
{
  owner: string | null,      // userId or null (unclaimed)
  color: string | null,      // CSS color or null
  capturedAt: number | null  // Milliseconds timestamp
}
```

**Transitions:**
- **Unclaimed → Claimed** – `owner = userId`, `color = user.color`, `capturedAt = now`
- **Claimed → Unclaimed** – `owner = null`, `color = null`, `capturedAt = null` (only if user owns it)
- **Someone Else's → Mine** – `owner = userId`, `color = my.color`, `capturedAt = now` (steal)

---

### Leaderboard Computation

Derived client-side on every `block_updated`:

1. Count blocks per `owner` from the current grid snapshot
2. Sort descending by count
3. Slice top 8
4. Map to `{ id, count, color, name }` using `playerNames` map
5. Highlight current player's entry

**Why client-side?** Reduces server load; leaderboard is already computable from grid state.

---

## 🎯 Performance Notes

### Network

- **Socket.io default:** Long-polling with automatic fallback (no manual reconnect needed)
- **Per block update:** ~100 bytes (blockId, owner, color, capturedAt)
- **Broadcast scope:** All connected sockets get `block_updated` (consider limiting if 1000+ players)

### Browser

- **20×20 grid:** 400 DOM nodes (Block divs)
- **CSS Grid layout:** Native browser optimization; ~60 fps animations
- **State updates:** React re-renders Grid, which re-renders changed Blocks (memoization optional for large grids)

### Server

- **Event loop single-threaded:** 100% natural serialization; no race conditions on grid state
- **Memory footprint:** ~10 KB per 400 blocks + ~1 KB per connected user

---

## 🔧 Configuration

### Server

Set via environment variables:

```bash
PORT=3001                    # Server port (default 3001)
CLIENT_ORIGIN=http://localhost:5173  # CORS origin
```

**Example:**
```bash
PORT=8080 CLIENT_ORIGIN=http://example.com npm start
```

---

### Client

Vite config points to server via `VITE_SERVER_URL`:

```bash
# .env or .env.local
VITE_SERVER_URL=http://localhost:3001
```

If not set, defaults to `http://localhost:3001`.

---

## 🚀 Scaling & Deployment

### Local Development

Current architecture runs as:
- Single Node process (server)
- Single Vite dev server (client)
- In-memory state (no persistence)

Ideal for solo testing, prototyping, or small jam sessions (< 50 concurrent players).

---

### Horizontal Scaling

To scale beyond one server:

#### Option 1: Redis Adapter (Recommended)

```javascript
// server/index.js
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const pubClient = createClient();
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
});
```

**Benefit:** Multiple Node processes share a Redis pub/sub channel; each process broadcasts grid updates to its own clients.

**Sticky Sessions:** If behind a load balancer, route each WebSocket to the same backend process (IP hash or session ID).

---

#### Option 2: Stateless Grid + Redis Store

```javascript
// grid.js
const redis = require("redis");
const client = redis.createClient();

async function getGridSnapshot() {
  const snap = await client.hGetAll("grid");
  return Object.fromEntries(
    Object.entries(snap).map(([k, v]) => [k, JSON.parse(v)])
  );
}

async function handleCapture(userId, blockId, users) {
  // ... logic ...
  await client.hSet("grid", blockId, JSON.stringify(block));
  return result;
}
```

**Benefit:** Persistent state across process restarts; horizontal scaling without sticky sessions.

---

#### Option 3: Message Queue (Advanced)

Replace direct `io.emit(...)` with Kafka/RabbitMQ pub/sub:
- Game servers consume `block_updated` from the queue
- Analytics, replay, or persistence services also consume the stream
- Decouples game logic from downstream services

---

### Database Integration (Future)

Add Postgres for archival:

```javascript
// Periodic snapshot (every 10 seconds)
setInterval(async () => {
  const snap = getGridSnapshot();
  await db.query("INSERT INTO grid_snapshots (data, created_at) VALUES ($1, NOW())", 
    [JSON.stringify(snap)]);
}, 10000);
```

Or snapshot on player disconnect for lightweight persistence.

---

## 🛠️ Development

### Running Tests

Currently no automated tests; recommended coverage:

- `grid.js` → Unit tests for claim/release/steal logic
- `socket` events → Integration tests for join/capture/disconnect flow
- React components → Component tests for animations and state updates

**Setup (suggested):**
```bash
npm install --save-dev vitest @testing-library/react

# Run tests
npm run test
```

---

### Code Style

```bash
# Lint
cd client && npm run lint

# Fix
cd client && npm run lint -- --fix
```

---

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes with clear messages
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request with a description

---

## 📝 File-by-File Overview

### Server Files

#### `server/index.js` (147 lines)
- Express + Socket.io setup
- REST routes: `/api/grid`, `/api/status`
- Socket events: `join`, `capture`, `disconnect`
- Color palette management
- Online user tracking
- Broadcast helpers

#### `server/grid.js` (74 lines)
- Grid state (20×20 Map)
- `initGrid()` – Initialize empty grid
- `getGridSnapshot()` – Export as plain object
- `handleCapture()` – Claim/release/steal logic with cooldown
- `getBlockCounts()` – Count blocks per player

---

### Client Files

#### `client/src/App.jsx` (300 lines)
- Top-level React component
- State: `me`, `grid`, `onlineCount`, `playerNames`, `cooldownUntil`, `toast`, etc.
- Socket listeners: `block_updated`, `cooldown_rejected`, `presence_update`
- Leaderboard derivation (useMemo)
- Cooldown countdown logic (useEffect)
- UI: topbar, grid, leaderboard, toast

#### `client/src/Grid.jsx` (47 lines)
- Renders 20×20 CSS Grid layout
- Maps pre-computed `BLOCK_IDS` array to Block components
- Passes grid data and handlers to each Block

#### `client/src/Block.jsx` (65 lines)
- Individual block component
- Owns/Claimed/Unclaimed state classes
- Pop animation on update (classList + reflow trick)
- Accessibility: role, aria-label, title attributes

#### `client/src/NamePrompt.jsx` (125 lines)
- Modal for name entry
- Random name generator (Adjective + Noun + Number)
- localStorage integration
- Socket.io join emission with callback

#### `client/src/socket.js` (7 lines)
- Singleton Socket.io-client instance
- `autoConnect: false` (manual connect after name entry)
- Exported for use across app

#### `client/src/styles.css` (comprehensive)
- CSS variables for colors, spacing, shadows
- Grid layout and animations
- Modal, topbar, leaderboard, block, toast styles
- Dark mode support via `@media (prefers-color-scheme: dark)`

---

## 🐛 Troubleshooting

### Issue: "Cannot GET /api/grid"
- **Cause:** Server not running
- **Fix:** `cd server && npm start` (or `npm run dev` from root)

---

### Issue: Client says "Could not connect to server"
- **Cause:** Server URL mismatch or CORS issue
- **Fix:** 
  - Check `VITE_SERVER_URL` in client `.env`
  - Ensure `CLIENT_ORIGIN` in server matches client origin
  - Check browser console for CORS errors

---

### Issue: Changes in one tab don't sync to another
- **Cause:** Socket.io not connecting or firewall blocking WebSocket
- **Fix:**
  - Open DevTools → Network → see if WebSocket upgrade succeeds
  - Try force-reloading both tabs
  - Check server logs for socket connection messages

---

### Issue: Blocks not updating after click
- **Cause:** Cooldown active or server error
- **Fix:**
  - Wait for cooldown timer to finish
  - Check server console for error logs
  - Verify network request succeeded (DevTools → Network)

---

### Issue: Name not persisting after refresh
- **Cause:** localStorage disabled or private browsing
- **Fix:**
  - Check if localStorage is enabled in browser
  - Disable private/incognito mode
  - Clear browser cookies and try again

---

## 📊 Metrics & Monitoring

### Suggested Metrics

```javascript
// server/index.js - add monitoring
setInterval(() => {
  console.log(`[metrics] Online: ${users.size}, Total known: ${knownUsers.size}`);
}, 10000);
```

### Logs to Watch

```
[join] PlayerName (uuid-xxxx) reconnected. Online: 12
[capture] Player captured block 5-12. Online: 12
[disconnect] Player left. Online: 11
```

---

## 📄 License

MIT License – see LICENSE file for details.

---

## 🎓 Learning Resources

- **Socket.io Docs:** https://socket.io/docs/
- **React Hooks:** https://react.dev/reference/react
- **CSS Grid:** https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout
- **Vite:** https://vitejs.dev/
- **Express:** https://expressjs.com/

---

## 🤝 Support & Feedback

Found a bug? Have a feature idea?

1. Check existing GitHub Issues
2. Create a new Issue with:
   - Steps to reproduce
   - Expected vs. actual behavior
   - Browser & OS info
   - Screenshots (if applicable)

---

## ✅ Acceptance Checklist

- [x] Two browser tabs: clicking in tab A instantly recolors in tab B
- [x] Clicking own block releases it for everyone
- [x] Clicking someone else's block steals it
- [x] Clicking within 3 s is rejected with visible cooldown — no state change
- [x] Refresh preserves identity (localStorage) and shows live grid
- [x] Online count updates on tab close
- [x] Capture logic isolated in `grid.js`
- [x] All comments removed from codebase
- [x] 15 commits with clear commit history

---

## Architecture

### Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, plain CSS (CSS Grid) |
| Real-time | Socket.io (server + client) |
| Backend | Node.js + Express |
| State | In-memory `Map` (no database) |
| Identity | UUID in `localStorage` (no accounts) |

### Why in-memory state?

Grid state and per-user cooldowns live in two plain `Map`s on the server. This is intentional:

- **Zero conflict-resolution overhead.** Node handles socket events on a single event loop, so two near-simultaneous clicks on the same block from different users are naturally serialized in arrival order — no explicit locks, no transactions.
- **Simplicity.** No ORM, no schema, no migration step. The trade-off is that state is reset on process restart.
- **Could swap in Redis** if scaling horizontally across processes — see *Scaling* below.

### Why no auth?

The spec is a session toy, not a persistent product. A UUID stored in `localStorage` survives page refresh and gives each player a stable identity within the session. Adding auth would add complexity with zero gameplay benefit.

### Single global grid

There's exactly one 20×20 grid shared by every connected player. No rooms, no lobbies. The global state model keeps the server logic trivially simple and the game instantly joinable.

---

## Capture / cooldown algorithm

In plain English:

1. **Per-user cooldown (3 seconds).** When a user clicks any block, the server records their `lastActionAt` timestamp. If the next click arrives within 3 seconds, the server sends a `cooldown_rejected` event back to that user only (no state change, no broadcast). The client shows a countdown timer and toast message.

2. **Claim.** If the block has no owner, assign it to the clicking user with their color.

3. **Release.** If the block is already owned by the clicking user, remove ownership (block returns to unclaimed).

4. **Steal.** If the block is owned by someone else, reassign it to the clicking user.

After any successful state change, the server broadcasts a `block_updated` event to *all* connected clients, who immediately animate and recolor that block. The client never applies optimistic updates — it waits for the server to respond.

---

## Project structure

```
/server
  index.js     Express + Socket.io server; handles join, capture, disconnect events
  grid.js      Grid state (Map) + handleCapture logic; exported as pure functions

/client/src
  App.jsx       Top-level state, socket listeners, cooldown countdown, leaderboard
  Grid.jsx      20×20 CSS Grid layout; renders 400 Block components
  Block.jsx     Individual block — pop/shake animations, ownership dot, aria attrs
  NamePrompt.jsx  Modal for display-name entry; emits join and stores userId in localStorage
  socket.js     Singleton socket.io-client instance (autoConnect: false)
  styles.css    Design system: tokens, grid, animations, modal, topbar, leaderboard, toast
```

---

## Socket.io event reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join` | `{ name, userId? }` | Register/re-register player |
| `capture` | `{ blockId }` | Attempt to claim/release/steal |

### Server → Client

| Event | Payload | Audience |
|---|---|---|
| `init` | `{ you, grid }` | Joining socket only |
| `block_updated` | `{ blockId, owner, color, capturedAt }` | **All** clients |
| `cooldown_rejected` | `{ blockId, remainingMs }` | Rejected socket only |
| `presence_update` | `{ onlineCount }` | **All** clients |

---

## REST endpoints

| Route | Description |
|---|---|
| `GET /api/grid` | Full grid snapshot (JSON); used for initial load / fallback |
| `GET /api/status` | Health check; returns `{ ok, connectedUsers }` |

---

## Scaling further

The current design runs as a single long-running Node process — correct for WebSockets (which need a persistent connection, unlike serverless functions).

To scale horizontally:

- **Redis pub/sub** — Replace direct `io.emit(...)` calls with publish to a Redis channel. Each Node process subscribes and fans out to its own connected sockets. Socket.io has a first-party [Redis adapter](https://socket.io/docs/v4/redis-adapter/) for exactly this.
- **Sticky sessions** — If running behind a load balancer, route each client's HTTP upgrade and subsequent Socket.io long-polling fallback to the same process (sticky/affinity sessions). Not needed if you switch to the WebSocket transport only.
- **Message broker alternative** — For larger scale, replace Redis with Kafka or RabbitMQ so grid-update events can be consumed by additional services (analytics, replay, persistence) without coupling them to the game server.
- **Optional DB snapshotting** — Keep state in-memory for speed, but run a `setInterval` every N seconds to write the grid snapshot to Postgres or Redis so a process restart restores the last-known state instead of a blank grid.
- **Horizontal grid sharding** — For very large grids, partition block ranges across microservices. Each service owns a shard; a gateway routes `capture` events to the correct shard and aggregates `block_updated` broadcasts.

---

## Acceptance checklist

- [x] Two browser tabs: clicking in tab A instantly recolors in tab B
- [x] Clicking own block releases it for everyone
- [x] Clicking someone else's block steals it
- [x] Clicking within 3 s is rejected with visible cooldown — no state change
- [x] Refresh preserves identity (localStorage) and shows live grid
- [x] Online count updates on tab close
- [x] Capture logic isolated in `grid.js`