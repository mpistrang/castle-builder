const fs = require('fs');
const path = require('path');
const config = require('./config');

class Persistence {
  constructor() {
    this.dataDir = path.resolve(config.DATA_DIR);
    this._ensureDataDir();
  }

  /**
   * Create the data directory if it doesn't already exist.
   */
  _ensureDataDir() {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
    } catch (err) {
      // Only throw if it's something other than "already exists"
      if (err.code !== 'EEXIST') {
        console.error(`Failed to create data directory: ${this.dataDir}`, err);
        throw err;
      }
    }
  }

  /**
   * Return the file path for a given room code.
   */
  _filePath(roomCode) {
    return path.join(this.dataDir, `${roomCode}.json`);
  }

  /**
   * Save a castle grid to disk as JSON.
   */
  save(roomCode, grid) {
    const filePath = this._filePath(roomCode);
    try {
      const json = JSON.stringify(grid);
      fs.writeFileSync(filePath, json, 'utf8');
    } catch (err) {
      console.error(`Failed to save castle for room ${roomCode}:`, err);
    }
  }

  /**
   * Load a castle grid from disk. Returns the parsed grid, or null if
   * the file doesn't exist or contains invalid JSON.
   */
  load(roomCode) {
    const filePath = this._filePath(roomCode);
    try {
      const json = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(json);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No persisted data for this room — that's fine
        return null;
      }
      // Bad JSON or other read error — log and treat as missing
      console.error(`Failed to load castle for room ${roomCode}:`, err);
      return null;
    }
  }

  /**
   * Delete the persisted file for a room, if it exists.
   */
  delete(roomCode) {
    const filePath = this._filePath(roomCode);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Failed to delete castle file for room ${roomCode}:`, err);
      }
    }
  }
}

module.exports = Persistence;
