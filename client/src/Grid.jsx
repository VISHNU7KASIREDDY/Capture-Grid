import { useCallback } from 'react';
import Block from './Block';

const GRID_SIZE = 20;

const BLOCK_IDS = [];
for (let row = 0; row < GRID_SIZE; row++) {
  for (let col = 0; col < GRID_SIZE; col++) {
    BLOCK_IDS.push(`${row}-${col}`);
  }
}

export default function Grid({
  grid,
  myUserId,
  onCapture,
  cooldownActive,
  pendingBlockId,
  flashBlockId,
}) {
  const handleCapture = useCallback(
    (blockId) => {
      onCapture(blockId);
    },
    [onCapture]
  );

  return (
    <div className="grid-container" aria-label="Block Capture grid">
      {BLOCK_IDS.map((blockId) => {
        const block = grid[blockId] || { owner: null, color: null, capturedAt: null };
        return (
          <Block
            key={blockId}
            blockId={blockId}
            block={block}
            myUserId={myUserId}
            onCapture={handleCapture}
            cooldownActive={cooldownActive}
            pendingBlockId={pendingBlockId}
            flashBlockId={flashBlockId}
          />
        );
      })}
    </div>
  );
}
