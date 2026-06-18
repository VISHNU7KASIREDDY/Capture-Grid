const GRID_SIZE = 20;

const grid = new Map();

function initGrid() {
  grid.clear();
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const blockId = `${row}-${col}`;
      grid.set(blockId, { owner: null, color: null, capturedAt: null });
    }
  }
}

function getGridSnapshot() {
  const snapshot = {};
  for (const [id, block] of grid.entries()) {
    snapshot[id] = { ...block };
  }
  return snapshot;
}

function handleCapture(userId, blockId, users) {
  const now = Date.now();
  const user = users.get(userId);

  if (!user) return { rejected: true, remainingMs: 0 };

  const elapsed = now - (user.lastActionAt || 0);
  if (elapsed < 3000) {
    const remainingMs = 3000 - elapsed;
    return { rejected: true, remainingMs };
  }

  const block = grid.get(blockId);
  if (!block) return { rejected: true, remainingMs: 0 };

  if (block.owner === null) {
    // Unclaimed → capture it
    block.owner = userId;
    block.color = user.color;
    block.capturedAt = now;
  } else if (block.owner === userId) {
    // Own block → release it
    block.owner = null;
    block.color = null;
    block.capturedAt = null;
  } else {
    // Someone else's block → steal it
    block.owner = userId;
    block.color = user.color;
    block.capturedAt = now;
  }

  user.lastActionAt = now;

  return {
    updated: true,
    blockId,
    block: { ...block },
  };
}

function getBlockCounts() {
  const counts = new Map();
  for (const block of grid.values()) {
    if (block.owner) {
      counts.set(block.owner, (counts.get(block.owner) || 0) + 1);
    }
  }
  return counts;
}

module.exports = { initGrid, getGridSnapshot, handleCapture, getBlockCounts, GRID_SIZE };
