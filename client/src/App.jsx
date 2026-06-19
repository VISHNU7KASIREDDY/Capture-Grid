import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { socket } from './socket';
import NamePrompt from './NamePrompt';
import Grid from './Grid';

const COOLDOWN_MS = 3000;

export default function App() {
  const [me, setMe] = useState(null);

  const [grid, setGrid] = useState({});
  const [onlineCount, setOnlineCount] = useState(1);

  const [playerNames, setPlayerNames] = useState({});

  const [autoJoining, setAutoJoining] = useState(false);

  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef(null);

  const [pendingBlockId, setPendingBlockId] = useState(null);
  const [flashBlockId, setFlashBlockId] = useState(null);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const cooldownActive = Date.now() < cooldownUntil;

  useEffect(() => {
    const existingId = localStorage.getItem('capture_userId');
    const existingName = localStorage.getItem('capture_name');

    if (existingId && existingName) {
      setAutoJoining(true);
      socket.connect();
      socket.emit('join', { name: existingName, userId: existingId }, (data) => {
        setAutoJoining(false);
        if (data) {
          const { you, grid: initialGrid, names } = data;
          localStorage.setItem('capture_userId', you.id);
          localStorage.setItem('capture_name', you.name);
          setMe(you);
          setGrid(initialGrid);
          if (names) setPlayerNames(names);
        } else {
          socket.disconnect();
        }
      });
    }
  }, []);

  const showToast = useCallback((message) => {
    const id = Date.now();
    setToast({ message, id });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownRemaining(0);
      return;
    }

    const tick = () => {
      const rem = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(rem);
      if (rem > 0) {
        cooldownTimerRef.current = setTimeout(tick, 50);
      }
    };
    tick();

    return () => clearTimeout(cooldownTimerRef.current);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!me) return;

    const handleBlockUpdated = ({ blockId, owner, color, capturedAt }) => {
      setGrid((prev) => ({
        ...prev,
        [blockId]: { owner, color, capturedAt },
      }));
      setPendingBlockId((prev) => (prev === blockId ? null : prev));
      setFlashBlockId(blockId);
      setTimeout(() => setFlashBlockId(null), 250);
    };

    const handleCooldownRejected = ({ remainingMs }) => {
      const until = Date.now() + remainingMs;
      setCooldownUntil(until);
      setPendingBlockId(null);
      const secs = (remainingMs / 1000).toFixed(1);
      showToast(`Wait ${secs}s before your next move`);
    };

    const handlePresenceUpdate = ({ onlineCount: count, names }) => {
      setOnlineCount(count);
      if (names) setPlayerNames(names);
    };

    socket.on('block_updated', handleBlockUpdated);
    socket.on('cooldown_rejected', handleCooldownRejected);
    socket.on('presence_update', handlePresenceUpdate);

    return () => {
      socket.off('block_updated', handleBlockUpdated);
      socket.off('cooldown_rejected', handleCooldownRejected);
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [me, showToast]);

  const handleCapture = useCallback(
    (blockId) => {
      if (!me) return;

      setPendingBlockId(blockId);
      socket.emit('capture', { blockId });

      setTimeout(() => setPendingBlockId((p) => (p === blockId ? null : p)), 2000);
    },
    [me]
  );

  const handleJoined = useCallback(({ you, grid: initialGrid, names }) => {
    setMe(you);
    setGrid(initialGrid);
    if (names) setPlayerNames(names);
  }, []);

  const leaderboard = useMemo(() => {
    const counts = {};
    const colors = {};
    for (const block of Object.values(grid)) {
      if (block.owner) {
        counts[block.owner] = (counts[block.owner] || 0) + 1;
        colors[block.owner] = block.color;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([id, count]) => ({ id, count, color: colors[id], name: playerNames[id] || '—' }));
  }, [grid, playerNames]);

  const myBlockCount = useMemo(
    () => (me ? (leaderboard.find((e) => e.id === me.id)?.count || 0) : 0),
    [leaderboard, me]
  );

  const cooldownProgress = cooldownUntil > 0 ? cooldownRemaining / COOLDOWN_MS : 0;
  const ringCircumference = 2 * Math.PI * 18;
  const ringOffset = ringCircumference * (1 - cooldownProgress);

  if (autoJoining) {
    return (
      <div className="modal-overlay">
        <div className="modal-card" style={{ gap: 16 }}>
          <div className="modal-logo">
            <span className="logo-icon"></span>
            <span className="logo-icon accent"></span>
            <span className="logo-icon"></span>
          </div>
          <h1 className="modal-title">Block Capture</h1>
          <span className="spinner" style={{ margin: '8px auto', borderColor: 'rgba(79,110,247,.3)', borderTopColor: '#4f6ef7' }} />
          <p className="modal-hint">Reconnecting to the grid…</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return <NamePrompt onJoined={handleJoined} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="brand-icon"></span>
            <span className="brand-name">Block Capture</span>
          </div>
        </div>

        <div className="topbar-center">
          <div className={`cooldown-ring-wrap ${cooldownActive ? 'active' : ''}`} title="Cooldown timer">
            <svg className="cooldown-ring" viewBox="0 0 40 40" width="40" height="40">
              <circle cx="20" cy="20" r="18" className="ring-track" />
              <circle
                cx="20"
                cy="20"
                r="18"
                className="ring-fill"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                style={{ transition: cooldownActive ? 'stroke-dashoffset 0.05s linear' : 'none' }}
              />
            </svg>
            <span className="ring-label">
              {cooldownActive ? `${(cooldownRemaining / 1000).toFixed(1)}s` : '✓'}
            </span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="identity-chip">
            <span
              className="color-swatch"
              style={{ backgroundColor: me.color }}
              title="Your color"
            />
            <span className="identity-name">{me.name}</span>
            <span className="identity-blocks" title="Your captured blocks">
              {myBlockCount} blocks
            </span>
          </div>

          <div className="online-badge" title="Players online">
            <span className="online-dot" />
            <span>{onlineCount} online</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="grid-wrapper">
          <Grid
            grid={grid}
            myUserId={me.id}
            onCapture={handleCapture}
            cooldownActive={cooldownActive}
            pendingBlockId={pendingBlockId}
            flashBlockId={flashBlockId}
          />
        </div>

        <aside className="leaderboard">
          <h2 className="leaderboard-title">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="leaderboard-empty">No blocks captured yet</p>
          ) : (
            <ol className="leaderboard-list">
              {leaderboard.map((entry, i) => (
                <li
                  key={entry.id}
                  className={`leaderboard-item ${entry.id === me.id ? 'leaderboard-me' : ''}`}
                >
                  <span className="lb-rank">#{i + 1}</span>
                  <span
                    className="lb-swatch"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="lb-name">
                    {entry.name}
                  </span>
                  <span className="lb-count">{entry.count}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="legend">
            <div className="legend-item">
              <span className="legend-block unclaimed-preview" />
              <span>Unclaimed</span>
            </div>
            <div className="legend-item">
              <span className="legend-block" style={{ backgroundColor: me.color }} />
              <span>Yours</span>
            </div>
            <div className="legend-item">
              <span className="legend-block" style={{ backgroundColor: '#888' }} />
              <span>Others</span>
            </div>
          </div>

          <div className="how-to-play">
            <h3>How to play</h3>
            <ul>
              <li>Click any block to capture it</li>
              <li>Click your block to release it</li>
              <li>Click others' blocks to steal them</li>
              <li>3 s cooldown between actions</li>
            </ul>
          </div>
        </aside>
      </main>

      {toast && (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      )}
    </div>
  );
}
