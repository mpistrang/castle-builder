const Redis = require('ioredis');
const config = require('./config');

const KEY_PREFIX = 'castle:';

class Persistence {
  constructor() {
    if (config.REDIS_URL) {
      this.redis = new Redis(config.REDIS_URL);
      this.redis.on('connect', () => console.log('Connected to Redis'));
      this.redis.on('error', (err) => console.error('Redis error:', err.message));
    } else {
      console.warn('REDIS_URL not set — persistence disabled');
      this.redis = null;
    }
  }

  /**
   * Save a castle grid to Redis with a TTL.
   */
  async save(roomCode, grid) {
    if (!this.redis) return;
    try {
      await this.redis.set(
        KEY_PREFIX + roomCode,
        JSON.stringify(grid),
        'EX',
        config.ROOM_TTL_SECONDS
      );
    } catch (err) {
      console.error(`Failed to save castle for room ${roomCode}:`, err.message);
    }
  }

  /**
   * Load a castle grid from Redis. Returns the parsed grid, or null
   * if the key doesn't exist or contains invalid JSON.
   */
  async load(roomCode) {
    if (!this.redis) return null;
    try {
      const json = await this.redis.get(KEY_PREFIX + roomCode);
      return json ? JSON.parse(json) : null;
    } catch (err) {
      console.error(`Failed to load castle for room ${roomCode}:`, err.message);
      return null;
    }
  }

  /**
   * Delete the persisted data for a room.
   */
  async delete(roomCode) {
    if (!this.redis) return;
    try {
      await this.redis.del(KEY_PREFIX + roomCode);
    } catch (err) {
      console.error(`Failed to delete castle for room ${roomCode}:`, err.message);
    }
  }

  /**
   * Gracefully close the Redis connection.
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = Persistence;
