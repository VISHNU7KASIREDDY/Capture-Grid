import { useState, useCallback } from 'react';
import { socket } from './socket';

const ADJECTIVES = ['Swift', 'Bold', 'Keen', 'Brave', 'Bright', 'Calm', 'Sharp', 'Quick'];
const NOUNS = ['Fox', 'Bear', 'Hawk', 'Wolf', 'Lynx', 'Crow', 'Deer', 'Owl'];

function randomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

export default function NamePrompt({ onJoined }) {
  // Pre-fill with stored name if available (server unreachable during auto-join)
  const [name, setName] = useState(
    () => localStorage.getItem('capture_name') || randomName()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a display name.');
      return;
    }
    if (trimmed.length > 24) {
      setError('Name must be 24 characters or less.');
      return;
    }

    setLoading(true);
    setError('');

    // Send existing userId so the server can restore color (if known)
    const existingId = localStorage.getItem('capture_userId');

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join', { name: trimmed, userId: existingId }, (data) => {
      if (!data) {
        setError('Could not connect to server. Please try again.');
        setLoading(false);
        socket.disconnect();
        return;
      }
      const { you, grid, names } = data;
      localStorage.setItem('capture_userId', you.id);
      localStorage.setItem('capture_name', you.name);
      onJoined({ you, grid, names });
    });
  }, [name, onJoined]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin();
  };

  const isReturning = Boolean(localStorage.getItem('capture_userId'));

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-logo">
          <span className="logo-icon">⬛</span>
          <span className="logo-icon accent">🟦</span>
          <span className="logo-icon">⬛</span>
        </div>
        <h1 className="modal-title">Block Capture</h1>
        <p className="modal-subtitle">
          {isReturning
            ? 'Welcome back! Jump back in or change your name.'
            : 'Claim blocks on a shared 20×20 grid. Steal from rivals. Hold your ground.'}
        </p>

        <div className="modal-field">
          <label htmlFor="display-name" className="field-label">
            Your display name
          </label>
          <div className="field-row">
            <input
              id="display-name"
              type="text"
              className="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={24}
              placeholder="Enter a name…"
              autoFocus
              disabled={loading}
            />
            <button
              className="randomize-btn"
              onClick={() => setName(randomName())}
              title="Random name"
              disabled={loading}
              type="button"
            >
              🎲
            </button>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>

        <button
          id="join-btn"
          className={`join-btn ${loading ? 'loading' : ''}`}
          onClick={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <>{isReturning ? 'Rejoin the Grid' : 'Join the Grid'}</>
          )}
        </button>

        <p className="modal-hint">No account needed — just pick a name and play.</p>
      </div>
    </div>
  );
}
