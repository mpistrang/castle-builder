import { io } from 'socket.io-client';

/**
 * Singleton wrapper around Socket.IO client.
 * Manages the connection lifecycle and provides typed methods
 * for every event in the castle-builder socket contract.
 */
class SocketClient {
  constructor() {
    this.socket = null;
    // Stored for auto-rejoin after reconnect
    this._roomCode = null;
    this._playerName = null;
    this._onReconnect = null;
  }

  /**
   * Open a Socket.IO connection to the server.
   * Auto-detects the URL from the current page origin so it works
   * in both local dev (Vite proxy) and production deployments.
   */
  connect() {
    if (this.socket) return;

    // In dev, Vite proxies /socket.io to the backend.
    // In production, the same origin serves everything.
    const url = window.location.origin;
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // When Socket.IO reconnects after a server restart, re-join the room
    // so the server rebuilds its socketRooms mapping for this client.
    this.socket.on('connect', () => {
      if (this._roomCode && this._playerName) {
        this.socket.emit('join-room', {
          roomCode: this._roomCode,
          playerName: this._playerName,
        });
      }
      if (this._onReconnect) this._onReconnect('connected');
    });

    this.socket.on('disconnect', () => {
      if (this._onReconnect) this._onReconnect('disconnected');
    });

    this.socket.on('reconnecting', () => {
      if (this._onReconnect) this._onReconnect('reconnecting');
    });
  }

  /** Register a callback for connection status changes: 'connected' | 'disconnected' | 'reconnecting' */
  onConnectionStatus(callback) {
    this._onReconnect = callback;
  }

  /** Ask the server to create a new room. */
  createRoom(roomCode, playerName) {
    if (!this.socket) return;
    this._roomCode = roomCode;
    this._playerName = playerName;
    this.socket.emit('create-room', { roomCode, playerName });
  }

  /** Ask the server to join an existing room. */
  joinRoom(roomCode, playerName) {
    if (!this.socket) return;
    this._roomCode = roomCode;
    this._playerName = playerName;
    this.socket.emit('join-room', { roomCode, playerName });
  }

  /** Send a build/destroy action at the given grid position. */
  sendAction({ x, y, mode, brushSize }) {
    if (!this.socket) return;
    this.socket.emit('action', { position: { x, y }, mode, brushSize: brushSize || 1 });
  }

  /** Clear all blocks in the room. */
  sendClear() {
    if (!this.socket) return;
    this.socket.emit('clear');
  }

  /** Broadcast the local player's new grid position. */
  sendMove(position) {
    if (!this.socket) return;
    this.socket.emit('move', { position: { x: position.x, y: position.y } });
  }

  /** Gracefully leave the current room. */
  leaveRoom() {
    if (!this.socket) return;
    this._roomCode = null;
    this._playerName = null;
    this.socket.emit('leave-room');
  }

  /** Register a listener for a server event. */
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  /** Remove a previously registered listener. */
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  /** Disconnect and clean up. */
  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }
}

// Export as singleton so every module shares one connection
export default new SocketClient();
