const { GRID_WIDTH, GRID_HEIGHT, MAX_PLAYERS, ACTION_RATE_LIMIT_MS } = require('../shared/constants');

module.exports = {
  PORT: process.env.PORT || 3000,
  GRID_WIDTH,
  GRID_HEIGHT,
  MAX_PLAYERS,
  ACTION_RATE_LIMIT_MS,
  REDIS_URL: process.env.REDIS_URL || null,
  ROOM_TTL_SECONDS: parseInt(process.env.ROOM_TTL_SECONDS, 10) || 60 * 60 * 24 * 7, // 7 days
  // Room allowlist — only these room codes can be created/joined
  ALLOWED_ROOMS: process.env.ALLOWED_ROOMS
    ? process.env.ALLOWED_ROOMS.split(',').map(r => r.trim())
    : [],
};
