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

    // ── Info button (top-left, after room code) ──────────
    this.infoBtnBg = this.add.circle(MARGIN + 160, MARGIN + 10, 12, 0x335577)
      .setStrokeStyle(2, 0x6699bb)
      .setInteractive({ useHandCursor: true });
    this.add.text(MARGIN + 160, MARGIN + 10, '?', {
      fontSize: '16px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.infoBtnBg.on('pointerdown', () => this._toggleHelp());

    // Help popup (hidden by default)
    this._createHelpPopup(width, height);

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
      .setStrokeStyle(3, 0xffffff)
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
    const sliderY = clearBtnY + 52;

    this.add.text(btnX, sliderY - 18, 'Brush Size', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#dddddd',
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

    this.brushSizeText = this.add.text(btnX, sliderY + 36, 'Size: 1', {
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

    // ── Connection status (bottom-left) ───────────────────
    this.connectionText = this.add.text(MARGIN, height - MARGIN, '', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ff6666',
    }).setOrigin(0, 1).setVisible(false);

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

  /** Show or hide connection status. */
  setConnectionStatus(status) {
    if (!this.connectionText) return;
    if (status === 'connected') {
      this.connectionText.setVisible(false);
    } else if (status === 'disconnected') {
      this.connectionText.setText('Disconnected — reconnecting...');
      this.connectionText.setVisible(true);
    } else if (status === 'reconnecting') {
      this.connectionText.setText('Reconnecting...');
      this.connectionText.setVisible(true);
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
    const icon = isBuild ? '+' : 'x';
    this.toggleText.setText(`${icon} ${this.currentMode.toUpperCase()}`);
  }

  _createHelpPopup(sceneWidth, sceneHeight) {
    const popupW = 340;
    const popupH = 260;
    const px = sceneWidth / 2;
    const py = sceneHeight / 2;

    // Use a container so visibility toggles all children at once
    this.helpContainer = this.add.container(0, 0);
    this.helpContainer.setDepth(100);

    // Dim overlay
    const overlay = this.add.rectangle(sceneWidth / 2, sceneHeight / 2, sceneWidth, sceneHeight, 0x000000, 0.5)
      .setInteractive();
    overlay.on('pointerdown', () => this._toggleHelp());

    // Panel background
    const panel = this.add.rectangle(px, py, popupW, popupH, 0x1a1a2e)
      .setStrokeStyle(2, 0xf0c060);

    // Title
    const title = this.add.text(px, py - popupH / 2 + 24, 'How to Play', {
      fontSize: '20px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#f0c060',
    }).setOrigin(0.5);

    // Instructions
    const instructions = [
      'Arrow keys    Move around the grid',
      'Space         Build or destroy',
      '',
      'BUILD mode    Places blocks around you',
      'DESTROY mode  Removes blocks around you',
      '',
      'Brush Size    Slider controls area size (1-5)',
      'CLEAR ALL     Wipes the entire castle',
    ];

    const body = this.add.text(px - popupW / 2 + 24, py - popupH / 2 + 52, instructions.join('\n'), {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#cccccc',
      lineSpacing: 4,
    });

    // Close hint
    const closeHint = this.add.text(px, py + popupH / 2 - 20, 'click anywhere to close', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5);

    this.helpContainer.add([overlay, panel, title, body, closeHint]);
    this.helpContainer.setVisible(false);
  }

  _toggleHelp() {
    const visible = !this.helpContainer.visible;
    this.helpContainer.setVisible(visible);
  }
}
