import { BLOCK_TYPES } from '../../../shared/constants.js';

const TILE_SIZE = 20;

// Base color palettes for each block type
const PALETTES = {
  [BLOCK_TYPES.FOUNDATION]: {
    base: '#5a5a5a',
    light: '#6e6e6e',
    dark: '#3d3d3d',
    accent: '#4a4a4a',
  },
  [BLOCK_TYPES.WALL]: {
    base: '#8a7b6b',
    light: '#9e8e7c',
    dark: '#6b5c4e',
    accent: '#7a6b5b',
  },
  [BLOCK_TYPES.WOOD_PLANK]: {
    base: '#8b6914',
    light: '#a37c1e',
    dark: '#6b4e0a',
    accent: '#7a5c10',
  },
  [BLOCK_TYPES.TOWER]: {
    base: '#6b6b7a',
    light: '#7e7e8e',
    dark: '#4a4a58',
    accent: '#5a5a6a',
  },
  [BLOCK_TYPES.TOWER_CAP]: {
    base: '#4a5a6a',
    light: '#5a6a7a',
    dark: '#3a4a5a',
    accent: '#6a7a8a',
  },
  [BLOCK_TYPES.BATTLEMENT]: {
    base: '#7a7a7a',
    light: '#8e8e8e',
    dark: '#5a5a5a',
    accent: '#6a6a6a',
  },
  [BLOCK_TYPES.WINDOW]: {
    base: '#8a7b6b',
    light: '#9e8e7c',
    dark: '#1a2a3a',
    accent: '#5a8aaa',
  },
  [BLOCK_TYPES.DOOR]: {
    base: '#6b4e14',
    light: '#8a6a2a',
    dark: '#4a3008',
    accent: '#3a3a3a',
  },
  [BLOCK_TYPES.FLAG]: {
    base: '#cc2222',
    light: '#ee4444',
    dark: '#881111',
    accent: '#6a5a4a',
  },
  [BLOCK_TYPES.TORCH]: {
    base: '#6a5a4a',
    light: '#ffaa22',
    dark: '#4a3a2a',
    accent: '#ff6600',
  },
  [BLOCK_TYPES.ROOF]: {
    base: '#7a3030',
    light: '#8e4040',
    dark: '#5a2020',
    accent: '#6a2828',
  },
  [BLOCK_TYPES.MOSS]: {
    base: '#8a7b6b',
    light: '#4a8a3a',
    dark: '#3a6a2a',
    accent: '#5a9a4a',
  },
};

/**
 * Generate all block tile textures into the Phaser texture manager.
 * Call once during scene preload or create.
 */
export function generateTileTextures(scene) {
  for (const blockType of Object.values(BLOCK_TYPES)) {
    const palette = PALETTES[blockType];
    if (!palette) continue;

    // Create 2-3 variants per block type
    const variants = getVariantCount(blockType);
    for (let v = 0; v < variants; v++) {
      const key = tileKey(blockType, v);
      if (scene.textures.exists(key)) continue;

      const canvas = scene.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
      const ctx = canvas.getContext();
      drawTile(ctx, blockType, palette, v);
      canvas.refresh();
    }
  }
}

function getVariantCount(blockType) {
  switch (blockType) {
    case BLOCK_TYPES.FOUNDATION:
    case BLOCK_TYPES.WALL:
    case BLOCK_TYPES.TOWER:
      return 3;
    case BLOCK_TYPES.WOOD_PLANK:
    case BLOCK_TYPES.ROOF:
      return 2;
    default:
      return 1;
  }
}

export function tileKey(blockType, variant = 0) {
  return `tile_${blockType}_${variant}`;
}

export function getRandomVariant(blockType) {
  const count = getVariantCount(blockType);
  return Math.floor(Math.random() * count);
}

// ── Drawing functions ──────────────────────────────────────

function drawTile(ctx, blockType, palette, variant) {
  switch (blockType) {
    case BLOCK_TYPES.FOUNDATION: drawFoundation(ctx, palette, variant); break;
    case BLOCK_TYPES.WALL: drawWall(ctx, palette, variant); break;
    case BLOCK_TYPES.WOOD_PLANK: drawWoodPlank(ctx, palette, variant); break;
    case BLOCK_TYPES.TOWER: drawTower(ctx, palette, variant); break;
    case BLOCK_TYPES.TOWER_CAP: drawTowerCap(ctx, palette); break;
    case BLOCK_TYPES.BATTLEMENT: drawBattlement(ctx, palette); break;
    case BLOCK_TYPES.WINDOW: drawWindow(ctx, palette); break;
    case BLOCK_TYPES.DOOR: drawDoor(ctx, palette); break;
    case BLOCK_TYPES.FLAG: drawFlag(ctx, palette); break;
    case BLOCK_TYPES.TORCH: drawTorch(ctx, palette); break;
    case BLOCK_TYPES.ROOF: drawRoof(ctx, palette, variant); break;
    case BLOCK_TYPES.MOSS: drawMoss(ctx, palette); break;
    default: drawGenericBlock(ctx, palette); break;
  }

  // Faux-3D shading on all tiles
  addShading(ctx);
}

function addShading(ctx) {
  // Light edge (top + left)
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, TILE_SIZE, 1);
  ctx.fillRect(0, 0, 1, TILE_SIZE);

  // Dark edge (bottom + right)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, TILE_SIZE - 1, TILE_SIZE, 1);
  ctx.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE);
}

// ── Foundation: large stone blocks with mortar ──────────

function drawFoundation(ctx, p, variant) {
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Mortar lines
  ctx.fillStyle = p.dark;
  // Horizontal mortar
  ctx.fillRect(0, 9, TILE_SIZE, 1);
  // Vertical mortar — offset per variant
  const offsets = [6, 10, 4];
  const vOff = offsets[variant] || 6;
  ctx.fillRect(vOff, 0, 1, 9);
  ctx.fillRect((vOff + 10) % TILE_SIZE, 10, 1, 10);

  // Stone texture specks
  ctx.fillStyle = p.light;
  const specks = [[3, 3], [14, 5], [8, 14], [16, 12], [2, 16]];
  for (const [sx, sy] of specks) {
    ctx.fillRect((sx + variant * 3) % TILE_SIZE, sy, 1, 1);
  }
}

// ── Wall: brick pattern ─────────────────────────────────

function drawWall(ctx, p, variant) {
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  ctx.fillStyle = p.dark;

  // Horizontal mortar lines (4 rows of bricks)
  for (let row = 0; row < 4; row++) {
    const y = row * 5 + 4;
    ctx.fillRect(0, y, TILE_SIZE, 1);
  }

  // Vertical mortar — staggered per row
  for (let row = 0; row < 4; row++) {
    const yStart = row * 5;
    const offset = (row + variant) % 2 === 0 ? 0 : 5;
    for (let vx = offset; vx < TILE_SIZE; vx += 10) {
      ctx.fillRect(vx, yStart, 1, 5);
    }
  }

  // Subtle brick color variation
  ctx.fillStyle = p.light;
  const bricks = [[2, 1], [12, 6], [7, 11], [17, 16]];
  for (const [bx, by] of bricks) {
    ctx.fillRect((bx + variant * 4) % TILE_SIZE, by, 3, 2);
  }
}

// ── Wood plank: horizontal grain ────────────────────────

function drawWoodPlank(ctx, p, variant) {
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Wood grain lines
  ctx.fillStyle = p.dark;
  const grainYs = variant === 0 ? [3, 7, 12, 16] : [2, 6, 11, 15];
  for (const gy of grainYs) {
    ctx.fillRect(0, gy, TILE_SIZE, 1);
  }

  // Knots
  ctx.fillStyle = p.accent;
  const knotX = variant === 0 ? 6 : 13;
  ctx.fillRect(knotX, 8, 2, 2);
  ctx.fillStyle = p.dark;
  ctx.fillRect(knotX, 9, 1, 1);

  // Light grain highlights
  ctx.fillStyle = p.light;
  ctx.fillRect(0, 5, TILE_SIZE, 1);
  ctx.fillRect(0, 14, TILE_SIZE, 1);
}

// ── Tower: darker vertical-emphasis stone ───────────────

function drawTower(ctx, p, variant) {
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Vertical mortar emphasis
  ctx.fillStyle = p.dark;
  ctx.fillRect(9, 0, 1, TILE_SIZE);

  // Horizontal mortar
  const hOff = variant * 3;
  ctx.fillRect(0, (6 + hOff) % TILE_SIZE, TILE_SIZE, 1);
  ctx.fillRect(0, (14 + hOff) % TILE_SIZE, TILE_SIZE, 1);

  // Stone texture
  ctx.fillStyle = p.light;
  ctx.fillRect(3, 3 + variant, 2, 1);
  ctx.fillRect(13, 10 + variant, 2, 1);
  ctx.fillRect(5, 16, 1, 1);
}

// ── Tower cap: pointed top ──────────────────────────────

function drawTowerCap(ctx, p) {
  // Sky/transparent background
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Pointed cap shape — triangle from center top to bottom corners
  ctx.fillStyle = p.base;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(20, 16);
  ctx.lineTo(0, 16);
  ctx.closePath();
  ctx.fill();

  // Base strip
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 16, TILE_SIZE, 4);

  // Shingle lines on the cap
  ctx.fillStyle = p.light;
  ctx.beginPath();
  ctx.moveTo(10, 4);
  ctx.lineTo(16, 12);
  ctx.moveTo(10, 4);
  ctx.lineTo(4, 12);
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.dark;
  ctx.stroke();

  // Tip highlight
  ctx.fillStyle = p.accent;
  ctx.fillRect(9, 0, 2, 2);
}

// ── Battlement: crenellation (notched top) ──────────────

function drawBattlement(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Main body — lower 2/3
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 6, TILE_SIZE, 14);

  // Raised merlons (the teeth)
  ctx.fillRect(0, 0, 7, 6);
  ctx.fillRect(13, 0, 7, 6);

  // Mortar lines
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 12, TILE_SIZE, 1);
  ctx.fillRect(3, 6, 1, 6);
  ctx.fillRect(16, 6, 1, 6);

  // Stone highlights
  ctx.fillStyle = p.light;
  ctx.fillRect(1, 1, 2, 1);
  ctx.fillRect(14, 1, 2, 1);
  ctx.fillRect(8, 8, 3, 1);
}

// ── Window: arched window with dark interior ────────────

function drawWindow(ctx, p) {
  // Wall background
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Window frame
  ctx.fillStyle = p.light;
  ctx.fillRect(5, 3, 10, 14);

  // Dark interior
  ctx.fillStyle = p.dark;
  ctx.fillRect(6, 4, 8, 12);

  // Arch top
  ctx.fillStyle = p.light;
  ctx.fillRect(7, 2, 6, 2);
  ctx.fillRect(8, 1, 4, 1);

  ctx.fillStyle = p.dark;
  ctx.fillRect(8, 3, 4, 1);

  // Cross bar
  ctx.fillStyle = p.accent;
  ctx.fillRect(6, 9, 8, 1);
  ctx.fillRect(9, 4, 1, 12);

  // Glass tint
  ctx.fillStyle = 'rgba(100,160,220,0.3)';
  ctx.fillRect(6, 4, 3, 5);
  ctx.fillRect(10, 4, 4, 5);
  ctx.fillRect(6, 10, 3, 6);
  ctx.fillRect(10, 10, 4, 6);
}

// ── Door: arched wood door ──────────────────────────────

function drawDoor(ctx, p) {
  // Wall surround
  ctx.fillStyle = '#8a7b6b';
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Door frame
  ctx.fillStyle = p.accent;
  ctx.fillRect(4, 0, 12, TILE_SIZE);

  // Wood door
  ctx.fillStyle = p.base;
  ctx.fillRect(5, 0, 10, TILE_SIZE);

  // Arch
  ctx.fillStyle = p.accent;
  ctx.fillRect(6, 0, 8, 1);
  ctx.fillRect(7, 1, 6, 1);

  // Wood grain
  ctx.fillStyle = p.dark;
  ctx.fillRect(5, 5, 10, 1);
  ctx.fillRect(5, 10, 10, 1);
  ctx.fillRect(5, 15, 10, 1);

  // Planks
  ctx.fillRect(9, 0, 1, TILE_SIZE);

  // Handle
  ctx.fillStyle = p.light;
  ctx.fillRect(12, 10, 2, 2);
  ctx.fillStyle = '#888';
  ctx.fillRect(12, 10, 1, 1);
}

// ── Flag: triangle on a pole ────────────────────────────

function drawFlag(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Pole
  ctx.fillStyle = p.accent;
  ctx.fillRect(3, 0, 2, TILE_SIZE);

  // Flag triangle
  ctx.fillStyle = p.base;
  ctx.beginPath();
  ctx.moveTo(5, 2);
  ctx.lineTo(17, 6);
  ctx.lineTo(5, 10);
  ctx.closePath();
  ctx.fill();

  // Flag highlight
  ctx.fillStyle = p.light;
  ctx.fillRect(6, 4, 4, 2);

  // Flag shadow
  ctx.fillStyle = p.dark;
  ctx.fillRect(6, 7, 6, 2);

  // Pole tip
  ctx.fillStyle = '#ccaa44';
  ctx.fillRect(2, 0, 4, 2);
}

// ── Torch: bracket with flame ───────────────────────────

function drawTorch(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Wall bracket
  ctx.fillStyle = p.base;
  ctx.fillRect(8, 10, 4, 8);
  ctx.fillRect(6, 9, 8, 2);

  // Torch stick
  ctx.fillStyle = p.dark;
  ctx.fillRect(9, 4, 2, 8);

  // Flame — layered glow
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(8, 1, 4, 4);
  ctx.fillStyle = p.accent;
  ctx.fillRect(9, 0, 2, 3);
  ctx.fillStyle = p.light;
  ctx.fillRect(9, 1, 2, 2);
  ctx.fillStyle = '#ffee44';
  ctx.fillRect(10, 1, 1, 1);

  // Glow around flame
  ctx.fillStyle = 'rgba(255,170,34,0.15)';
  ctx.fillRect(5, 0, 10, 7);
}

// ── Roof: angled tiles ──────────────────────────────────

function drawRoof(ctx, p, variant) {
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Tile rows — overlapping shingle pattern
  for (let row = 0; row < 4; row++) {
    const y = row * 5;
    const offset = (row + variant) % 2 === 0 ? 0 : 5;
    ctx.fillStyle = row % 2 === 0 ? p.light : p.accent;
    for (let tx = offset; tx < TILE_SIZE; tx += 10) {
      ctx.fillRect(tx, y, 9, 4);
    }
    // Shingle edge shadow
    ctx.fillStyle = p.dark;
    ctx.fillRect(0, y + 4, TILE_SIZE, 1);
  }
}

// ── Moss: stone with green patches ──────────────────────

function drawMoss(ctx, p) {
  // Base stone
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  // Mortar
  ctx.fillStyle = '#6b5c4e';
  ctx.fillRect(0, 9, TILE_SIZE, 1);
  ctx.fillRect(8, 0, 1, 9);

  // Moss patches
  ctx.fillStyle = p.dark;
  ctx.fillRect(0, 0, 5, 4);
  ctx.fillRect(12, 6, 6, 4);
  ctx.fillRect(2, 14, 4, 4);

  ctx.fillStyle = p.light;
  ctx.fillRect(1, 1, 3, 2);
  ctx.fillRect(13, 7, 4, 2);
  ctx.fillRect(3, 15, 2, 2);

  // Highlight fronds
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 3, 2, 1);
  ctx.fillRect(14, 9, 3, 1);
  ctx.fillRect(1, 17, 3, 1);
}

function drawGenericBlock(ctx, p) {
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
}
