const Castle = require('./Castle');
const Persistence = require('./Persistence');
const config = require('./config');

// Single shared Persistence instance for all rooms
const persistence = new Persistence();

class Room {
  /** All active rooms, keyed by room code. */
  static rooms = new Map();

  constructor(roomCode, castle) {
    this.roomCode = roomCode;
    this.castle = castle;
    /** socketId -> { name, position } */
    this.players = new Map();
    /** socketId -> timestamp of last action (for rate limiting) */
    this._lastActionTime = new Map();
  }

  // ---------------------------------------------------------------------------
  // Static room lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create a new room. Validates the room code against the allowlist,
   * loads any persisted castle data, and registers the room.
   * Returns the Room instance, or throws on invalid/duplicate codes.
   */
  static create(roomCode) {
    if (!config.ALLOWED_ROOMS.includes(roomCode)) {
      throw new Error(`Room code "${roomCode}" is not in the allowlist`);
    }

    if (Room.rooms.has(roomCode)) {
      throw new Error(`Room "${roomCode}" already exists`);
    }

    // Try to restore a previously-saved castle, otherwise start fresh
    const savedGrid = persistence.load(roomCode);
    const castle = new Castle(config.GRID_WIDTH, config.GRID_HEIGHT);

    if (savedGrid) {
      castle.grid = savedGrid;
    }

    const room = new Room(roomCode, castle);
    Room.rooms.set(roomCode, room);
    return room;
  }

  /**
   * Look up an active room by code.
   */
  static get(roomCode) {
    return Room.rooms.get(roomCode) || null;
  }

  /**
   * Remove a room from the active set.
   */
  static remove(roomCode) {
    Room.rooms.delete(roomCode);
  }

  // ---------------------------------------------------------------------------
  // Player management
  // ---------------------------------------------------------------------------

  /**
   * Add a player to this room.
   * Returns the player info object, or throws if the room is full.
   */
  addPlayer(socketId, playerName) {
    if (this.players.size >= config.MAX_PLAYERS) {
      throw new Error(`Room "${this.roomCode}" is full (max ${config.MAX_PLAYERS} players)`);
    }

    const player = {
      name: playerName,
      position: { x: 20, y: 15 },
    };

    this.players.set(socketId, player);
    return player;
  }

  /**
   * Remove a player. If the room becomes empty, persist the castle
   * and remove the room from the active set.
   */
  removePlayer(socketId) {
    this.players.delete(socketId);
    this._lastActionTime.delete(socketId);

    if (this.players.size === 0) {
      persistence.save(this.roomCode, this.castle.grid);
      Room.remove(this.roomCode);
    }
  }

  /**
   * Get all players as an array of { name, position }.
   */
  getPlayers() {
    return Array.from(this.players.values()).map(({ name, position }) => ({
      name,
      position,
    }));
  }

  /**
   * Update a player's grid position.
   */
  updatePosition(socketId, position) {
    const player = this.players.get(socketId);
    if (player) {
      player.position = position;
    }
  }

  /**
   * Check whether enough time has passed since this player's last action.
   * If yes, updates the timestamp and returns true (action allowed).
   * If no, returns false (action should be rejected).
   */
  checkRateLimit(socketId) {
    const now = Date.now();
    const lastTime = this._lastActionTime.get(socketId) || 0;

    if (now - lastTime < config.ACTION_RATE_LIMIT_MS) {
      return false;
    }

    this._lastActionTime.set(socketId, now);
    return true;
  }

  /**
   * Return a player's display name, or null if not found.
   */
  getPlayerName(socketId) {
    const player = this.players.get(socketId);
    return player ? player.name : null;
  }

  /**
   * Persist the current castle state to disk.
   */
  save() {
    persistence.save(this.roomCode, this.castle.grid);
  }
}

module.exports = Room;
