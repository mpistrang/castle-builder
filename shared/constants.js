// Block types — used by both client and server
const BLOCK_TYPES = {
  FOUNDATION: 'foundation',
  WALL: 'wall',
  WOOD_PLANK: 'wood_plank',
  TOWER: 'tower',
  TOWER_CAP: 'tower_cap',
  BATTLEMENT: 'battlement',
  WINDOW: 'window',
  DOOR: 'door',
  FLAG: 'flag',
  TORCH: 'torch',
  ROOF: 'roof',
  MOSS: 'moss',
};

// Blocks that don't need support below them
const GRAVITY_EXEMPT = [BLOCK_TYPES.FLAG, BLOCK_TYPES.TORCH];

// Grid dimensions
const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

// Gameplay
const MAX_PLAYERS = 4;
const ACTION_RATE_LIMIT_MS = 500;
const BLOCKS_PER_ACTION_MIN = 1;
const BLOCKS_PER_ACTION_MAX = 3;

// Room codes
const ROOM_CODE_MIN_LENGTH = 2;
const ROOM_CODE_MAX_LENGTH = 12;

module.exports = {
  BLOCK_TYPES,
  GRAVITY_EXEMPT,
  GRID_WIDTH,
  GRID_HEIGHT,
  MAX_PLAYERS,
  ACTION_RATE_LIMIT_MS,
  BLOCKS_PER_ACTION_MIN,
  BLOCKS_PER_ACTION_MAX,
  ROOM_CODE_MIN_LENGTH,
  ROOM_CODE_MAX_LENGTH,
};
