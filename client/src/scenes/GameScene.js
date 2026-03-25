import Phaser from 'phaser';
import { CastleRenderer, TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y } from '../castle/CastleRenderer.js';
import { GRID_WIDTH, GRID_HEIGHT } from '../../../shared/constants.js';
import socketClient from '../network/SocketClient.js';

// Movement cooldown in ms — ~10 tiles/second when holding a key
const MOVE_COOLDOWN_MS = 100;

// Player avatar size in pixels
const PLAYER_SIZE = 16;

// Sky gradient top/bottom colors
const SKY_COLOR_TOP = 0x87ceeb;
const SKY_COLOR_BOTTOM = 0x4682b4;

// Ground strip color and height
const GROUND_COLOR = 0x228b22;
const GROUND_HEIGHT = 20;

// Camera paging — shift by 25 tiles when player reaches screen edge
const PAGE_SHIFT_TILES = 40;
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// World dimensions in pixels
const WORLD_WIDTH = GRID_WIDTH * TILE_SIZE;
const WORLD_HEIGHT = SCREEN_HEIGHT;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    this.castleRenderer = null;
    this.playerSprite = null;
    this.playerLabel = null;
    this.otherPlayers = new Map();
    this.cursors = null;
    this.spaceKey = null;
    this.mode = 'build';
    this.brushSize = 1;
    this.grid = null;

    // Grid position of the local player (integers)
    this.gridX = 20;
    this.gridY = 15;

    // Movement timing
    this.lastMoveTime = 0;

    // Room/player metadata passed from LobbyScene
    this.roomCode = null;
    this.playerName = null;

    // Mobile touch state
    this.touchActive = false;
    this.touchTarget = { x: 0, y: 0 };
  }

  /**
   * Receive data from LobbyScene when transitioning to this scene.
   * Expected shape: { roomCode, playerName, castle }
   */
  init(data) {
    this.roomCode = data.roomCode ?? null;
    this.playerName = data.playerName ?? 'Player';
    this.grid = data.castle ?? this._emptyGrid();
    this.initialPlayers = data.players || [];

    // Reset player position — start in the middle
    this.gridX = Math.floor(GRID_WIDTH / 2);
    this.gridY = Math.floor(GRID_HEIGHT / 2);
  }

  create() {
    // Set up camera to pan across the wider world
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this._drawBackground();

    // Castle renderer
    this.castleRenderer = new CastleRenderer(this);
    this.castleRenderer.render(this.grid);

    // Local player avatar
    this._createPlayerAvatar();

    // Center camera on initial player position
    this._snapCameraToPlayer();

    // Keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', this.onAction, this);

    // Mobile touch input
    this.input.on('pointerdown', (pointer) => {
      this.touchActive = true;
      this.touchTarget.x = pointer.x;
      this.touchTarget.y = pointer.y;
    });
    this.input.on('pointermove', (pointer) => {
      if (this.touchActive) {
        this.touchTarget.x = pointer.x;
        this.touchTarget.y = pointer.y;
      }
    });
    this.input.on('pointerup', () => {
      this.touchActive = false;
    });

    this.mode = 'build';
    this.lastMoveTime = 0;

    // Launch the UI overlay scene
    this.scene.launch('UIScene');
    const uiScene = this.scene.get('UIScene');
    if (uiScene && this.roomCode) {
      // Wait a tick for UIScene to create its objects
      this.time.delayedCall(100, () => {
        uiScene.setRoomCode(this.roomCode);
      });
    }

    // Add existing players from room join data
    if (this.initialPlayers) {
      for (const p of this.initialPlayers) {
        if (p.name !== this.playerName) {
          this.addOtherPlayer(p.name, p.position);
        }
      }
    }

    // Wire up socket events
    this._setupSocketListeners();
  }

  update(time, _delta) {
    const canMove = time - this.lastMoveTime >= MOVE_COOLDOWN_MS;
    if (!canMove) return;

    let dx = 0;
    let dy = 0;

    // Keyboard movement
    if (this.cursors.left.isDown) dx -= 1;
    if (this.cursors.right.isDown) dx += 1;
    if (this.cursors.up.isDown) dy -= 1;
    if (this.cursors.down.isDown) dy += 1;

    // Mobile touch movement — move toward the touch point one tile at a time
    if (this.touchActive && dx === 0 && dy === 0) {
      const world = this.castleRenderer.gridToScreen(this.gridX, this.gridY);
      // Convert world coords to screen coords for comparison with touch
      const cam = this.cameras.main;
      const cx = world.x + TILE_SIZE / 2 - cam.scrollX;
      const cy = world.y + TILE_SIZE / 2;

      const diffX = this.touchTarget.x - cx;
      const diffY = this.touchTarget.y - cy;

      // Only move if the touch is more than half a tile away
      const threshold = TILE_SIZE / 2;
      if (Math.abs(diffX) > threshold) dx = diffX > 0 ? 1 : -1;
      if (Math.abs(diffY) > threshold) dy = diffY > 0 ? 1 : -1;
    }

    if (dx === 0 && dy === 0) return;

    // Apply movement and clamp to grid bounds
    this.gridX = Phaser.Math.Clamp(this.gridX + dx, 0, GRID_WIDTH - 1);
    this.gridY = Phaser.Math.Clamp(this.gridY + dy, 0, GRID_HEIGHT - 1);
    this.lastMoveTime = time;

    this._updatePlayerPosition();

    // Broadcast position to other players
    socketClient.sendMove({ x: this.gridX, y: this.gridY });
  }

  // --- Public API (called by UIScene / SocketClient) ---

  /** Send build/destroy action to the server. */
  onAction() {
    socketClient.sendAction({
      x: this.gridX,
      y: this.gridY,
      mode: this.mode,
      brushSize: this.brushSize,
    });
  }

  /** Send clear-all action to the server. */
  onClear() {
    socketClient.sendClear();
  }

  /** Switch between 'build' and 'destroy' modes. */
  setMode(mode) {
    this.mode = mode;
  }

  /** Replace the stored grid and re-render the castle. */
  updateCastle(grid) {
    this.grid = grid;
    this.castleRenderer.update(this.grid);
  }

  /** Create a visual representation for another player in the room. */
  addOtherPlayer(name, position) {
    if (this.otherPlayers.has(name)) return;

    const screen = this.castleRenderer.gridToScreen(position.x, position.y);
    const centerX = screen.x + TILE_SIZE / 2;
    const centerY = screen.y + TILE_SIZE / 2;

    const sprite = this.add.rectangle(
      centerX,
      centerY,
      PLAYER_SIZE,
      PLAYER_SIZE,
      0x00ff00 // green for other players
    );
    sprite.setDepth(10);

    const label = this.add.text(centerX, centerY - PLAYER_SIZE, name, {
      fontSize: '10px',
      color: '#00ff00',
      align: 'center',
    });
    label.setOrigin(0.5, 1);
    label.setDepth(10);

    this.otherPlayers.set(name, { sprite, label });
  }

  /** Remove another player's avatar from the scene. */
  removeOtherPlayer(name) {
    const entry = this.otherPlayers.get(name);
    if (!entry) return;
    entry.sprite.destroy();
    entry.label.destroy();
    this.otherPlayers.delete(name);
  }

  /** Move another player's avatar to a new grid position. */
  moveOtherPlayer(name, position) {
    const entry = this.otherPlayers.get(name);
    if (!entry) return;

    const screen = this.castleRenderer.gridToScreen(position.x, position.y);
    const centerX = screen.x + TILE_SIZE / 2;
    const centerY = screen.y + TILE_SIZE / 2;

    entry.sprite.setPosition(centerX, centerY);
    entry.label.setPosition(centerX, centerY - PLAYER_SIZE);
  }

  // --- Socket event wiring ---

  _setupSocketListeners() {
    socketClient.on('castle-updated', (data) => {
      this.updateCastle(data.castle);
    });

    socketClient.on('player-joined', (data) => {
      this.addOtherPlayer(data.playerName, data.position);
      const uiScene = this.scene.get('UIScene');
      if (uiScene) {
        const names = [this.playerName, ...Array.from(this.otherPlayers.keys())];
        uiScene.updatePlayerList(names);
      }
    });

    socketClient.on('player-left', (data) => {
      this.removeOtherPlayer(data.playerName);
      const uiScene = this.scene.get('UIScene');
      if (uiScene) {
        const names = [this.playerName, ...Array.from(this.otherPlayers.keys())];
        uiScene.updatePlayerList(names);
      }
    });

    socketClient.on('player-moved', (data) => {
      this.moveOtherPlayer(data.playerName, data.position);
    });
  }

  // --- Internal helpers ---

  /** Draw sky gradient, distant hills, and layered ground across full world width. */
  _drawBackground() {
    const w = WORLD_WIDTH;
    const g = this.add.graphics();

    // Sky gradient
    const steps = SCREEN_HEIGHT - GROUND_HEIGHT;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(SKY_COLOR_TOP),
        Phaser.Display.Color.IntegerToColor(SKY_COLOR_BOTTOM),
        1,
        t
      );
      const hex = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
      g.fillStyle(hex, 1);
      g.fillRect(0, i, w, 1);
    }

    // Distant hills silhouette
    g.fillStyle(0x3a5a3a, 0.3);
    this._drawHills(g, 480, 12, 0.007, w);
    g.fillStyle(0x2a4a2a, 0.4);
    this._drawHills(g, 510, 18, 0.012, w);

    g.setDepth(-2);

    // Layered ground
    const groundG = this.add.graphics();
    const groundTop = SCREEN_HEIGHT - GROUND_HEIGHT;

    groundG.fillStyle(0x3a2a1a, 1);
    groundG.fillRect(0, groundTop, w, GROUND_HEIGHT);

    groundG.fillStyle(0x5a4020, 1);
    groundG.fillRect(0, groundTop, w, 12);

    groundG.fillStyle(0x4a8a30, 1);
    groundG.fillRect(0, groundTop, w, 4);

    // Grass tufts
    groundG.fillStyle(0x5aa838, 1);
    for (let tx = 0; tx < w; tx += 7) {
      const h = 2 + Math.sin(tx * 0.8) * 2;
      groundG.fillRect(tx, groundTop - h, 2, h);
    }

    groundG.setDepth(-1);
  }

  /** Draw a procedural hill silhouette using sine waves. */
  _drawHills(g, baseY, amplitude, frequency, width) {
    g.beginPath();
    g.moveTo(0, SCREEN_HEIGHT);
    for (let x = 0; x <= width; x += 2) {
      const y = baseY - Math.abs(Math.sin(x * frequency) * amplitude)
        - Math.abs(Math.sin(x * frequency * 2.3 + 1) * amplitude * 0.5);
      g.lineTo(x, y);
    }
    g.lineTo(width, SCREEN_HEIGHT);
    g.closePath();
    g.fillPath();
  }

  /** Create the local player's avatar rectangle and name label. */
  _createPlayerAvatar() {
    const screen = this.castleRenderer.gridToScreen(this.gridX, this.gridY);
    const centerX = screen.x + TILE_SIZE / 2;
    const centerY = screen.y + TILE_SIZE / 2;

    this.playerSprite = this.add.rectangle(
      centerX,
      centerY,
      PLAYER_SIZE,
      PLAYER_SIZE,
      0xffff00 // yellow for local player
    );
    this.playerSprite.setDepth(10);

    this.playerLabel = this.add.text(
      centerX,
      centerY - PLAYER_SIZE,
      this.playerName,
      {
        fontSize: '10px',
        color: '#ffff00',
        align: 'center',
      }
    );
    this.playerLabel.setOrigin(0.5, 1);
    this.playerLabel.setDepth(10);
  }

  /** Sync the player sprite and label to the current grid position. */
  _updatePlayerPosition() {
    const world = this.castleRenderer.gridToScreen(this.gridX, this.gridY);
    const centerX = world.x + TILE_SIZE / 2;
    const centerY = world.y + TILE_SIZE / 2;

    this.playerSprite.setPosition(centerX, centerY);
    this.playerLabel.setPosition(centerX, centerY - PLAYER_SIZE);

    // Check if player is near the edge of the visible area and page the camera
    this._checkCameraPan(centerX);
  }

  /** Snap the camera so the player's page is centered. */
  _snapCameraToPlayer() {
    const world = this.castleRenderer.gridToScreen(this.gridX, this.gridY);
    const playerWorldX = world.x + TILE_SIZE / 2;
    // Which page is the player on?
    const pagePixels = PAGE_SHIFT_TILES * TILE_SIZE;
    const page = Math.floor(playerWorldX / pagePixels);
    const scrollX = page * pagePixels;
    this.cameras.main.scrollX = Phaser.Math.Clamp(scrollX, 0, WORLD_WIDTH - SCREEN_WIDTH);
  }

  /** If the player moves past the visible screen edge, shift the camera by 25 tiles. */
  _checkCameraPan(playerWorldX) {
    const cam = this.cameras.main;
    const margin = TILE_SIZE * 2; // trigger when within 2 tiles of the edge
    const shiftPixels = PAGE_SHIFT_TILES * TILE_SIZE;

    if (playerWorldX > cam.scrollX + SCREEN_WIDTH - margin) {
      // Pan right
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX + shiftPixels, 0, WORLD_WIDTH - SCREEN_WIDTH);
    } else if (playerWorldX < cam.scrollX + margin) {
      // Pan left
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX - shiftPixels, 0, WORLD_WIDTH - SCREEN_WIDTH);
    }
  }

  /** Return a blank grid (2D array of nulls). */
  _emptyGrid() {
    return Array.from({ length: GRID_HEIGHT }, () =>
      Array.from({ length: GRID_WIDTH }, () => null)
    );
  }
}
