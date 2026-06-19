# Block Capture

A real-time, multiplayer block-claiming game built on a shared 20×20 grid. Click to capture, release, or steal blocks — every action is instantly visible to every connected player via WebSockets. No login. No database. Just play.

---

## Quick start

```bash
# 1. Install all dependencies (root concurrently + server + client)
npm run install:all

# 2. Start both servers with one command
npm run dev
```

- **Client** → http://localhost:5173
- **Server** → http://localhost:3001

Open two browser tabs to verify real-time sync.

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