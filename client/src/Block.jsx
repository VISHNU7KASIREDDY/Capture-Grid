import { useEffect, useRef, useCallback } from 'react';

export default function Block({
  blockId,
  block,
  myUserId,
  onCapture,
  cooldownActive,
  pendingBlockId,
  flashBlockId,
}) {
  const divRef = useRef(null);
  const isOwn = block.owner === myUserId;
  const isClaimed = block.owner !== null;
  const isPending = pendingBlockId === blockId;
  const isFlashing = flashBlockId === blockId;

  useEffect(() => {
    if (isFlashing && divRef.current) {
      divRef.current.classList.remove('block-pop');
      void divRef.current.offsetWidth;
      divRef.current.classList.add('block-pop');
    }
  }, [isFlashing, flashBlockId]);

  const handleClick = useCallback(() => {
    onCapture(blockId);
  }, [blockId, onCapture]);

  const blockStyle = {
    backgroundColor: isClaimed ? block.color : undefined,
  };

  const classNames = [
    'block',
    isClaimed ? 'claimed' : 'unclaimed',
    isOwn ? 'own' : '',
    isPending ? 'pending' : '',
    cooldownActive ? 'cooldown-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={divRef}
      className={classNames}
      style={blockStyle}
      onClick={handleClick}
      title={
        isClaimed
          ? isOwn
            ? 'Your block — click to release'
            : `Owned — click to steal`
          : 'Unclaimed — click to capture'
      }
      aria-label={`Block ${blockId}${isClaimed ? `, owned` : ', unclaimed'}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {isOwn && <span className="block-dot" />}
    </div>
  );
}
