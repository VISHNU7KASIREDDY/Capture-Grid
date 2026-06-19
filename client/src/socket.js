import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Warn loudly if falling back to localhost in a production build
if (import.meta.env.PROD && !import.meta.env.VITE_SERVER_URL) {
  console.error(
    '[capture-grid] VITE_SERVER_URL is not set. ' +
    'WebSocket connections will fail in production. ' +
    'Set VITE_SERVER_URL to your backend URL before building.'
  );
}

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling'],
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.warn('Socket disconnected:', reason);
});
