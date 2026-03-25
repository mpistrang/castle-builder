const {
  BLOCK_TYPES,
  GRAVITY_EXEMPT,
  BLOCKS_PER_ACTION_MIN,
  BLOCKS_PER_ACTION_MAX,
} = require('../shared/constants');

class Generator {
  /**
   * Generate 1-3 new blocks near the player's position.
   *
   * @param {import('./Castle')} castle - Castle instance
   * @param {number} px - Player x position on the grid
   * @param {number} py - Player y position on the grid
   * @returns {Array<{x: number, y: number, type: string}>} Blocks to place
   */
  generate(castle, px, py, brushSize = 1) {
    const blocks = [];
    const half = Math.floor(brushSize / 2);

    // Fill an NxN area centered on the player
    for (let dx = -half; dx < -half + brushSize; dx++) {
      for (let dy = -half; dy < -half + brushSize; dy++) {
        const x = px + dx;
        const y = py + dy;
        if (!castle.inBounds(x, y)) continue;
        if (!castle.isEmpty(x, y)) continue;

        const type = this._pickBlockType(castle, x, y);
        blocks.push({ x, y, type });
      }
    }

    return blocks;
  }

  /**
   * Pick block type based on height tier:
   *   Bottom 10 rows (y 20-29): stone (FOUNDATION)
   *   Middle 10 rows (y 10-19): brick (WALL)
   *   Top 10 rows    (y 0-9):  wood  (WOOD_PLANK)
   */
  _pickBlockType(castle, x, y) {
    const bottomTier = castle.height - 10; // y=20
    const midTier = castle.height - 20;    // y=10

    if (y >= bottomTier) {
      return BLOCK_TYPES.FOUNDATION;
    }
    if (y >= midTier) {
      return BLOCK_TYPES.WALL;
    }
    return BLOCK_TYPES.WOOD_PLANK;
  }

  /**
   * Place 3-5 foundation blocks at ground level near the player's x position.
   */
  _placeFoundation(castle, px) {
    const groundY = castle.height - 1;
    const count = 3 + Math.floor(Math.random() * 3); // 3-5
    const blocks = [];

    // Center the foundation around the player's x, clamped to grid
    const startX = Math.max(0, Math.min(px - Math.floor(count / 2), castle.width - count));

    for (let i = 0; i < count; i++) {
      const x = startX + i;
      if (x >= 0 && x < castle.width) {
        blocks.push({ x, y: groundY, type: BLOCK_TYPES.FOUNDATION });
      }
    }

    return blocks;
  }

  /**
   * Find empty cells near (px, py) that are adjacent to at least one existing
   * block and would have support (gravity rule). These are valid attachment points.
   */
  _findCandidates(castle, px, py, radius) {
    const candidates = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = px + dx;
        const y = py + dy;

        // Must be in bounds and empty
        if (!castle.inBounds(x, y)) continue;
        if (!castle.isEmpty(x, y)) continue;

        // Must be adjacent to at least one existing block
        const hasAdjacentBlock =
          !castle.isEmpty(x - 1, y) ||
          !castle.isEmpty(x + 1, y) ||
          !castle.isEmpty(x, y - 1) ||
          !castle.isEmpty(x, y + 1);

        if (!hasAdjacentBlock) continue;

        candidates.push({ x, y });
      }
    }

    return candidates;
  }

  /**
   * Score a candidate position for each possible block type. Returns an array
   * of { x, y, type, score } entries — one per viable block type at this cell.
   */
  _scoreCandidates(castle, candidate) {
    const { x, y } = candidate;
    const options = [];
    const groundY = castle.height - 1;
    const nearGroundY = castle.height - 2;

    const blockBelow = castle.getCell(x, y + 1);
    const blockAbove = castle.getCell(x, y - 1);
    const blockLeft = castle.getCell(x - 1, y);
    const blockRight = castle.getCell(x + 1, y);
    const neighborCount = castle.countNeighbors(x, y);

    // --- Foundation: ground level or near-ground ---
    if (y === groundY || y === nearGroundY) {
      options.push({ x, y, type: BLOCK_TYPES.FOUNDATION, score: 10 });
    }

    // --- Tower: continues a tower or foundation column upward ---
    if (blockBelow === BLOCK_TYPES.TOWER || blockBelow === BLOCK_TYPES.FOUNDATION) {
      options.push({ x, y, type: BLOCK_TYPES.TOWER, score: 8 });
    }

    // --- Wall: fills horizontal gaps between existing blocks ---
    if (blockLeft !== null && blockRight !== null) {
      options.push({ x, y, type: BLOCK_TYPES.WALL, score: 7 });
    }
    // Also score wall if it's extending horizontally from a wall/tower
    if (
      (blockLeft === BLOCK_TYPES.WALL || blockLeft === BLOCK_TYPES.TOWER) &&
      blockRight === null
    ) {
      options.push({ x, y, type: BLOCK_TYPES.WALL, score: 4 });
    }
    if (
      blockLeft === null &&
      (blockRight === BLOCK_TYPES.WALL || blockRight === BLOCK_TYPES.TOWER)
    ) {
      options.push({ x, y, type: BLOCK_TYPES.WALL, score: 4 });
    }

    // --- Tower cap: on top of a 3+ tall tower column with no block above ---
    if (blockBelow === BLOCK_TYPES.TOWER && blockAbove === null) {
      const towerHeight = this._measureColumnHeight(castle, x, y + 1);
      if (towerHeight >= 3) {
        options.push({ x, y, type: BLOCK_TYPES.TOWER_CAP, score: 9 });
      }
    }

    // --- Battlement: on top of a wall section ---
    if (
      blockAbove === null &&
      (blockBelow === BLOCK_TYPES.WALL || blockBelow === BLOCK_TYPES.WOOD_PLANK)
    ) {
      options.push({ x, y, type: BLOCK_TYPES.BATTLEMENT, score: 6 });
    }

    // --- Window: in a wall, above row 2 from ground ---
    if (
      blockLeft !== null &&
      blockRight !== null &&
      y < groundY - 2
    ) {
      // Low probability — add with a low score
      options.push({ x, y, type: BLOCK_TYPES.WINDOW, score: 2 });
    }

    // --- Door: at ground level in a wall section ---
    if (
      y === groundY &&
      blockLeft !== null &&
      blockRight !== null
    ) {
      options.push({ x, y, type: BLOCK_TYPES.DOOR, score: 2 });
    }

    // --- Decorations: only on "finished" sections (3+ neighbors) ---
    if (neighborCount >= 3) {
      // Flag — only on top (nothing above)
      if (blockAbove === null) {
        options.push({ x, y, type: BLOCK_TYPES.FLAG, score: 1 });
      }
      // Torch — on walls
      options.push({ x, y, type: BLOCK_TYPES.TORCH, score: 1 });
      // Moss — decorative
      options.push({ x, y, type: BLOCK_TYPES.MOSS, score: 1 });
    }

    // --- Wood plank: alternative to wall for upper sections ---
    if (y < nearGroundY && blockBelow !== null && blockAbove === null) {
      options.push({ x, y, type: BLOCK_TYPES.WOOD_PLANK, score: 3 });
    }

    // --- Roof: on top of wall sections, angled ---
    if (
      blockAbove === null &&
      blockBelow !== null &&
      (blockLeft !== null || blockRight !== null)
    ) {
      options.push({ x, y, type: BLOCK_TYPES.ROOF, score: 2 });
    }

    // Filter out options that would violate gravity
    const validOptions = options.filter((opt) =>
      castle.wouldHaveSupport(opt.x, opt.y, opt.type),
    );

    // If nothing scored, add a generic wall/foundation as a fallback
    // so we always have something to place at valid attachment points
    if (validOptions.length === 0) {
      if (y === groundY || y === nearGroundY) {
        const fallback = { x, y, type: BLOCK_TYPES.FOUNDATION, score: 3 };
        if (castle.wouldHaveSupport(x, y, BLOCK_TYPES.FOUNDATION)) {
          return [fallback];
        }
      }
      if (castle.wouldHaveSupport(x, y, BLOCK_TYPES.WALL)) {
        return [{ x, y, type: BLOCK_TYPES.WALL, score: 3 }];
      }
      return [];
    }

    return validOptions;
  }

  /**
   * Measure how many consecutive blocks exist in a column starting at (x, y)
   * going downward.
   */
  _measureColumnHeight(castle, x, startY) {
    let height = 0;
    for (let y = startY; y < castle.height; y++) {
      if (castle.getCell(x, y) !== null) {
        height++;
      } else {
        break;
      }
    }
    return height;
  }

  /**
   * Pick up to `count` blocks from scored candidates using weighted random
   * selection. Avoids picking the same cell twice.
   *
   * @param {Array<Array<{x, y, type, score}>>} scoredGroups - Each element is an array of options for one cell
   * @param {number} count - How many blocks to pick
   * @param {import('./Castle')} castle - Castle instance (to check conflicts)
   * @returns {Array<{x, y, type}>}
   */
  _pickWeighted(scoredGroups, count, castle) {
    // Flatten: for each cell, pick the best-scoring option (with some randomness)
    const flatCandidates = [];
    for (const group of scoredGroups) {
      if (group.length === 0) continue;
      // Pick one option from this cell's possibilities, weighted by score
      const picked = this._weightedPick(group);
      if (picked) flatCandidates.push(picked);
    }

    if (flatCandidates.length === 0) return [];

    const selected = [];
    const usedPositions = new Set();

    for (let i = 0; i < count && flatCandidates.length > 0; i++) {
      const pick = this._weightedPick(flatCandidates);
      if (!pick) break;

      const posKey = `${pick.x},${pick.y}`;
      if (usedPositions.has(posKey)) {
        // Remove this candidate and retry
        const idx = flatCandidates.indexOf(pick);
        if (idx !== -1) flatCandidates.splice(idx, 1);
        i--;
        continue;
      }

      usedPositions.add(posKey);
      selected.push({ x: pick.x, y: pick.y, type: pick.type });

      // Remove from candidates so we don't pick the same position again
      const idx = flatCandidates.indexOf(pick);
      if (idx !== -1) flatCandidates.splice(idx, 1);
    }

    return selected;
  }

  /**
   * Pick one item from an array using scores as weights.
   */
  _weightedPick(items) {
    if (items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + item.score, 0);
    if (totalWeight <= 0) return items[0];

    let roll = Math.random() * totalWeight;
    for (const item of items) {
      roll -= item.score;
      if (roll <= 0) return item;
    }
    // Fallback (shouldn't happen due to floating point, but just in case)
    return items[items.length - 1];
  }
}

module.exports = Generator;
