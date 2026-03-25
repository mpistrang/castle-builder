const { GRID_WIDTH, GRID_HEIGHT, MAX_PLAYERS, ACTION_RATE_LIMIT_MS } = require('../shared/constants');

module.exports = {
  PORT: process.env.PORT || 3000,
  GRID_WIDTH,
  GRID_HEIGHT,
  MAX_PLAYERS,
  ACTION_RATE_LIMIT_MS,
  DATA_DIR: process.env.DATA_DIR || './server/data',
  // Room allowlist — only these room codes can be created/joined
  ALLOWED_ROOMS: process.env.ALLOWED_ROOMS
    ? process.env.ALLOWED_ROOMS.split(',').map(r => r.trim())
    : [],
};
