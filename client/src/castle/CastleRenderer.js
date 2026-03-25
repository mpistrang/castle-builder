import { BLOCK_TYPES, GRID_WIDTH, GRID_HEIGHT } from '../../../shared/constants.js';
import { generateTileTextures, tileKey, getRandomVariant } from './TileGenerator.js';

const TILE_SIZE = 20;

// Game area is 800x600. Center the grid within it.
const GRID_PIXEL_WIDTH = GRID_WIDTH * TILE_SIZE;
const GRID_PIXEL_HEIGHT = GRID_HEIGHT * TILE_SIZE;
const GRID_OFFSET_X = Math.floor((800 - GRID_PIXEL_WIDTH) / 2);
const GRID_OFFSET_Y = Math.floor((600 - GRID_PIXEL_HEIGHT) / 2);

export class CastleRenderer {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.tileSprites = [];

    // Map of "x,y" -> chosen variant so blocks don't flicker on re-render
    this.variantMap = new Map();

    // Generate all pixel art tile textures
    generateTileTextures(scene);
  }

  /**
   * Full redraw of the castle grid using generated tile textures.
   */
  render(grid) {
    // Clean up previous tile sprites
    for (const sprite of this.tileSprites) {
      sprite.destroy();
    }
    this.tileSprites = [];

    // Redraw grid lines
    this.graphics.clear();
    this.graphics.lineStyle(1, 0xffffff, 0.03);
    for (let x = 0; x <= GRID_WIDTH; x++) {
      const px = GRID_OFFSET_X + x * TILE_SIZE;
      this.graphics.lineBetween(px, GRID_OFFSET_Y, px, GRID_OFFSET_Y + GRID_PIXEL_HEIGHT);
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      const py = GRID_OFFSET_Y + y * TILE_SIZE;
      this.graphics.lineBetween(GRID_OFFSET_X, py, GRID_OFFSET_X + GRID_PIXEL_WIDTH, py);
    }

    if (!grid) return;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < GRID_WIDTH; x++) {
        const blockType = row[x];
        if (blockType == null) continue;

        const posKey = `${x},${y}`;
        // Reuse previously chosen variant so blocks look stable
        if (!this.variantMap.has(posKey)) {
          this.variantMap.set(posKey, getRandomVariant(blockType));
        }
        const variant = this.variantMap.get(posKey);
        const key = tileKey(blockType, variant);

        const screenX = GRID_OFFSET_X + x * TILE_SIZE;
        const screenY = GRID_OFFSET_Y + y * TILE_SIZE;

        if (this.scene.textures.exists(key)) {
          const sprite = this.scene.add.image(screenX, screenY, key);
          sprite.setOrigin(0, 0);
          sprite.setDepth(1);
          this.tileSprites.push(sprite);
        }
      }
    }

    // Clean up variant entries for cells that are now empty
    for (const posKey of this.variantMap.keys()) {
      const [px, py] = posKey.split(',').map(Number);
      if (!grid[py] || grid[py][px] == null) {
        this.variantMap.delete(posKey);
      }
    }
  }

  /** Alias for render — full redraw for now. */
  update(grid) {
    this.render(grid);
  }

  /** Convert grid coordinates to the top-left screen pixel of that cell. */
  gridToScreen(gx, gy) {
    return {
      x: GRID_OFFSET_X + gx * TILE_SIZE,
      y: GRID_OFFSET_Y + gy * TILE_SIZE,
    };
  }

  /** Convert screen pixel coordinates to grid coordinates (floored). */
  screenToGrid(sx, sy) {
    return {
      x: Math.floor((sx - GRID_OFFSET_X) / TILE_SIZE),
      y: Math.floor((sy - GRID_OFFSET_Y) / TILE_SIZE),
    };
  }
}

export { TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y };
