import Phaser from 'phaser';

const MODE_BUILD = 'build';
const MODE_DESTROY = 'destroy';

const COLOR_BUILD = 0x4a8c5c;
const COLOR_DESTROY = 0x8c4a4a;

/**
 * HUD overlay that runs in parallel with GameScene.
 *
 * Displays:
 *  - Build / Destroy toggle button (top-right)
 *  - Room code (top-left)
 *  - Connected player list (top-left, below room code)
 *  - Instruction hint (bottom-center)
 *
 * Launched as a parallel scene by GameScene so it renders on top
 * without interfering with game input.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    const { width, height } = this.scale;
    const MARGIN = 16;

    this.currentMode = MODE_BUILD;

    // ── Room code (top-left) ──────────────────────────────
    this.roomCodeText = this.add.text(MARGIN, MARGIN, '', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#f0c060',
    });

    // ── Player list (top-left, below room code) ───────────
    this.playerListText = this.add.text(MARGIN, MARGIN + 28, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#cccccc',
      lineSpacing: 4,
    });

    // ── Build / Destroy toggle (top-right) ────────────────
    const btnWidth = 120;
    const btnHeight = 38;
    const btnX = width - MARGIN - btnWidth / 2;
    const btnY = MARGIN + btnHeight / 2;

    this.toggleBg = this.add.rectangle(btnX, btnY, btnWidth, btnHeight, COLOR_BUILD)
      .setInteractive({ useHandCursor: true });

    this.toggleText = this.add.text(btnX, btnY, MODE_BUILD.toUpperCase(), {
      fontSize: '16px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.toggleBg.on('pointerdown', () => this._toggle());

    // ── Clear button (below mode toggle) ────────────────
    const clearBtnY = btnY + btnHeight + 12;
    const clearBg = this.add.rectangle(btnX, clearBtnY, btnWidth, 32, 0x884444)
      .setInteractive({ useHandCursor: true });
    this.add.text(btnX, clearBtnY, 'CLEAR ALL', {
      fontSize: '13px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    clearBg.on('pointerdown', () => {
      const gameScene = this.scene.get('GameScene');
      if (gameScene && typeof gameScene.onClear === 'function') {
        gameScene.onClear();
      }
    });

    // ── Brush size slider (below clear button) ──────────
    this.brushSize = 1;
    const sliderY = clearBtnY + 44;

    this.add.text(btnX, sliderY - 14, 'Brush Size', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    const sliderWidth = 100;
    const sliderLeft = btnX - sliderWidth / 2;
    const sliderRight = btnX + sliderWidth / 2;

    // Track bar
    this.add.rectangle(btnX, sliderY + 6, sliderWidth, 4, 0x555555);

    // Tick marks and labels for 1-5
    for (let i = 1; i <= 5; i++) {
      const tickX = sliderLeft + ((i - 1) / 4) * sliderWidth;
      this.add.rectangle(tickX, sliderY + 6, 2, 10, 0x777777);
      this.add.text(tickX, sliderY + 18, `${i}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#888888',
      }).setOrigin(0.5, 0);
    }

    // Draggable handle
    this.sliderHandle = this.add.circle(sliderLeft, sliderY + 6, 8, 0xf0c060)
      .setInteractive({ useHandCursor: true, draggable: true });

    this.brushSizeText = this.add.text(btnX, sliderY + 32, 'Size: 1', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#f0c060',
    }).setOrigin(0.5);

    this.input.setDraggable(this.sliderHandle);
    this.sliderHandle.on('drag', (_pointer, dragX) => {
      const clampedX = Phaser.Math.Clamp(dragX, sliderLeft, sliderRight);
      this.sliderHandle.x = clampedX;

      // Map position to 1-5
      const ratio = (clampedX - sliderLeft) / sliderWidth;
      this.brushSize = Math.round(ratio * 4) + 1;
      this.brushSizeText.setText(`Size: ${this.brushSize}`);

      // Snap handle to tick position
      const snapX = sliderLeft + ((this.brushSize - 1) / 4) * sliderWidth;
      this.sliderHandle.x = snapX;

      const gameScene = this.scene.get('GameScene');
      if (gameScene) gameScene.brushSize = this.brushSize;
    });

    // ── Instruction text (bottom-center) ──────────────────
    this.add.text(width / 2, height - MARGIN, 'Arrow keys to move, Space to build/destroy', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#666666',
    }).setOrigin(0.5, 1);
  }

  // ─── Public API (called by GameScene or network handlers) ──

  /** Set the displayed room code. */
  setRoomCode(code) {
    if (this.roomCodeText) {
      this.roomCodeText.setText(`Room: ${code}`);
    }
  }

  /** Update the player name list. Expects an array of name strings. */
  updatePlayerList(players) {
    if (!this.playerListText) return;

    if (!players || players.length === 0) {
      this.playerListText.setText('');
      return;
    }

    const lines = players.map((name) => `  ${name}`);
    this.playerListText.setText(`Players:\n${lines.join('\n')}`);
  }

  /**
   * Programmatically set the mode (e.g. syncing from GameScene).
   * @param {'BUILD'|'DESTROY'} mode
   */
  setMode(mode) {
    this.currentMode = mode;
    this._updateToggleVisuals();
  }

  /** Return the current mode string. */
  getMode() {
    return this.currentMode;
  }

  // ─── Internal ──────────────────────────────────────────────

  _toggle() {
    this.currentMode = this.currentMode === MODE_BUILD ? MODE_DESTROY : MODE_BUILD;
    this._updateToggleVisuals();

    // Notify GameScene so it knows which action to send
    const gameScene = this.scene.get('GameScene');
    if (gameScene && typeof gameScene.setMode === 'function') {
      gameScene.setMode(this.currentMode);
    }
  }

  _updateToggleVisuals() {
    const isBuild = this.currentMode === MODE_BUILD;
    this.toggleBg.setFillStyle(isBuild ? COLOR_BUILD : COLOR_DESTROY);
    this.toggleText.setText(this.currentMode.toUpperCase());
  }
}
