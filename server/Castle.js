const {
  BLOCK_TYPES,
  GRAVITY_EXEMPT,
  GRID_WIDTH,
  GRID_HEIGHT,
  BLOCKS_PER_ACTION_MIN,
  BLOCKS_PER_ACTION_MAX,
} = require('../shared/constants');

class Castle {
  /**
   * @param {number} [width=GRID_WIDTH]
   * @param {number} [height=GRID_HEIGHT]
   */
  constructor(width = GRID_WIDTH, height = GRID_HEIGHT) {
    this.width = width;
    this.height = height;
    // grid[y][x] — y=0 is top, y=height-1 is ground level
    this.grid = this._createEmptyGrid();
  }

  _createEmptyGrid() {
    const grid = [];
    for (let y = 0; y < this.height; y++) {
      grid.push(new Array(this.width).fill(null));
    }
    return grid;
  }

  /**
   * Returns the block type at (x, y), or null if empty or out of bounds.
   */
  getCell(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.grid[y][x];
  }

  /**
   * Sets the block type at (x, y). No-op if out of bounds.
   */
  setCell(x, y, blockType) {
    if (!this.inBounds(x, y)) return;
    this.grid[y][x] = blockType;
  }

  /**
   * True if (x, y) is null or out of bounds.
   */
  isEmpty(x, y) {
    return this.getCell(x, y) === null;
  }

  /**
   * True if (x, y) is within grid boundaries.
   */
  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Returns the full grid for serialization.
   */
  getGrid() {
    return this.grid;
  }

  /**
   * Loads a grid from saved data (e.g. from persistence).
   * Updates width/height to match the loaded grid.
   */
  loadGrid(grid) {
    this.grid = grid;
    this.height = grid.length;
    this.width = grid.length > 0 ? grid[0].length : 0;
  }

  /**
   * True if the grid has no blocks at all.
   */
  isGridEmpty() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] !== null) return false;
      }
    }
    return true;
  }

  /**
   * Returns true if a block at (x, y) has support — either the cell below
   * is occupied, the block is on the ground row, or it's gravity-exempt.
   */
  hasSupport(x, y) {
    const blockType = this.getCell(x, y);
    if (blockType !== null && GRAVITY_EXEMPT.includes(blockType)) {
      return true;
    }
    // Ground row always has support
    if (y === this.height - 1) return true;
    // Supported if block below is occupied
    return !this.isEmpty(x, y + 1);
  }

  /**
   * Returns true if a hypothetical block of the given type placed at (x, y)
   * would have support.
   */
  wouldHaveSupport(x, y, blockType) {
    if (GRAVITY_EXEMPT.includes(blockType)) return true;
    if (y === this.height - 1) return true;
    return !this.isEmpty(x, y + 1);
  }

  /**
   * Counts how many of the 4 cardinal neighbors are occupied.
   */
  countNeighbors(x, y) {
    let count = 0;
    if (!this.isEmpty(x - 1, y)) count++;
    if (!this.isEmpty(x + 1, y)) count++;
    if (!this.isEmpty(x, y - 1)) count++;
    if (!this.isEmpty(x, y + 1)) count++;
    return count;
  }

  /**
   * Finds blocks on the outer edge of the structure — blocks that have at
   * least one empty cardinal neighbor, or sit on the grid perimeter.
   * Returns array of { x, y, type }.
   */
  findEdgeBlocks() {
    const edges = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const type = this.grid[y][x];
        if (type === null) continue;

        // On the grid perimeter, it's always an edge block
        if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
          edges.push({ x, y, type });
          continue;
        }
        // Has at least one empty cardinal neighbor
        if (
          this.isEmpty(x - 1, y) ||
          this.isEmpty(x + 1, y) ||
          this.isEmpty(x, y - 1) ||
          this.isEmpty(x, y + 1)
        ) {
          edges.push({ x, y, type });
        }
      }
    }
    return edges;
  }

  /**
   * After removing a block at (x, y), checks all blocks above and removes
   * any that are now unsupported. Works recursively upward.
   * Returns array of all removed positions (NOT including the original).
   */
  cascadeRemove(x, y) {
    const removed = [];
    // Check the block directly above
    this._cascadeUp(x, y - 1, removed);
    return removed;
  }

  _cascadeUp(x, y, removed) {
    if (!this.inBounds(x, y)) return;
    const blockType = this.getCell(x, y);
    if (blockType === null) return;

    // If this block still has support, stop
    if (this.hasSupport(x, y)) return;

    // Remove this unsupported block
    this.setCell(x, y, null);
    removed.push({ x, y, type: blockType });

    // Continue checking above
    this._cascadeUp(x, y - 1, removed);

    // Also check neighbors — removing this block might have been supporting
    // a decoration or adjacent block that relied on it indirectly.
    // Check left and right at same level (they might have been supported by
    // this block if this block was below them — but actually support is only
    // from directly below, so we only cascade straight up).
    // However, decorations attached to this block's sides might need removal
    // too. For simplicity, only cascade directly upward per the spec.
  }

  /**
   * Find edge blocks near (px, py) within the given radius that can be
   * safely removed. Returns array of { x, y, type }.
   */
  findRemovableNear(px, py, radius = 3) {
    const edgeBlocks = this.findEdgeBlocks();
    return edgeBlocks.filter((block) => {
      const dx = Math.abs(block.x - px);
      const dy = Math.abs(block.y - py);
      return dx <= radius && dy <= radius;
    });
  }

  /**
   * Destroy action: remove 1-3 edge blocks near the player position,
   * cascade-remove any unsupported blocks, and return all changed blocks
   * (with type: null for removed cells).
   */
  destroy(px, py, brushSize = 1) {
    const allChanged = [];
    const half = Math.floor(brushSize / 2);

    // Remove all blocks within the NxN brush area centered on the player
    for (let dx = -half; dx < -half + brushSize; dx++) {
      for (let dy = -half; dy < -half + brushSize; dy++) {
        const x = px + dx;
        const y = py + dy;
        if (!this.inBounds(x, y)) continue;
        if (this.isEmpty(x, y)) continue;

        this.setCell(x, y, null);
        allChanged.push({ x, y, type: null });
      }
    }

    return allChanged;
  }

  /** Reset the grid to all empty. */
  clear() {
    this.grid = this._createEmptyGrid();
  }

  /**
   * Build action: apply an array of { x, y, type } to the grid.
   * Returns the changed blocks (same format, for broadcasting).
   */
  build(newBlocks) {
    const changed = [];
    for (const block of newBlocks) {
      if (!this.inBounds(block.x, block.y)) continue;
      this.setCell(block.x, block.y, block.type);
      changed.push({ x: block.x, y: block.y, type: block.type });
    }
    return changed;
  }
}

module.exports = Castle;
