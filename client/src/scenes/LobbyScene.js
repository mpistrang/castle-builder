import Phaser from 'phaser';
import socketClient from '../network/SocketClient.js';

const MAX_ROOM_CODE_LENGTH = 12;
const MIN_ROOM_CODE_LENGTH = 2;
const MAX_NAME_LENGTH = 12;

/**
 * Room-entry screen.  Pure Phaser graphics — no DOM elements required.
 *
 * Two "input fields" are drawn as rectangles with editable text inside.
 * Clicking a field focuses it; keyboard events update the focused field.
 * CREATE and JOIN buttons connect via SocketClient and transition to
 * GameScene on success.
 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;

    // ── State ──────────────────────────────────────────────
    this.roomCode = '';
    this.playerName = '';
    this.focusedField = null; // 'roomCode' | 'playerName' | null
    this.busy = false;        // true while waiting for server response

    // ── Title ──────────────────────────────────────────────
    this.add.text(centerX, 60, 'Castle Builder', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#f0c060',
    }).setOrigin(0.5);

    this.add.text(centerX, 110, 'Build together. Destroy together.', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // ── Input fields ───────────────────────────────────────
    this.roomCodeField = this._createInputField(centerX, 200, 'ROOM CODE');
    this.playerNameField = this._createInputField(centerX, 280, 'YOUR NAME');

    // ── Buttons ────────────────────────────────────────────
    this._createButton(centerX, 370, 'JOIN', 0x4a6a8c, () => this._onJoin());

    // ── Status text (connection feedback / errors) ─────────
    this.statusText = this.add.text(centerX, 440, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ff6666',
    }).setOrigin(0.5);

    // ── Keyboard capture ───────────────────────────────────
    this.input.keyboard.on('keydown', this._onKeyDown, this);
  }

  // ───────────────────────────────────────────────────────────
  //  Input field helper
  // ───────────────────────────────────────────────────────────

  /**
   * Draws a rectangle "input field" with a placeholder label.
   * Returns an object with { bg, text, placeholder, fieldName }.
   */
  _createInputField(x, y, placeholder) {
    const fieldWidth = 280;
    const fieldHeight = 44;
    const fieldName = placeholder === 'ROOM CODE' ? 'roomCode' : 'playerName';

    const bg = this.add.rectangle(x, y, fieldWidth, fieldHeight, 0x222244)
      .setStrokeStyle(2, 0x555588)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y - 32, placeholder, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5);

    const displayText = this.add.text(x, y, '', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Cursor blink indicator — a thin rectangle appended after text
    const cursor = this.add.rectangle(x, y, 2, 26, 0xffffff).setVisible(false);
    this.tweens.add({
      targets: cursor,
      alpha: { from: 1, to: 0 },
      duration: 530,
      yoyo: true,
      repeat: -1,
    });

    bg.on('pointerdown', () => {
      this.focusedField = fieldName;
      this._refreshFields();
    });

    return { bg, displayText, cursor, label, fieldName };
  }

  /** Sync visual state of both fields with current values. */
  _refreshFields() {
    this._refreshField(this.roomCodeField, this.roomCode);
    this._refreshField(this.playerNameField, this.playerName);
  }

  _refreshField(field, value) {
    const isFocused = this.focusedField === field.fieldName;
    const displayValue = value || '';

    field.displayText.setText(displayValue);
    field.bg.setStrokeStyle(2, isFocused ? 0xf0c060 : 0x555588);
    field.cursor.setVisible(isFocused);

    // Position cursor right after the text
    const textBounds = field.displayText.getBounds();
    field.cursor.setPosition(textBounds.right + 4, field.bg.y);
  }

  // ───────────────────────────────────────────────────────────
  //  Keyboard handling
  // ───────────────────────────────────────────────────────────

  _onKeyDown(event) {
    if (!this.focusedField) return;

    const isRoomCode = this.focusedField === 'roomCode';
    const maxLen = isRoomCode ? MAX_ROOM_CODE_LENGTH : MAX_NAME_LENGTH;
    let value = isRoomCode ? this.roomCode : this.playerName;

    if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.BACKSPACE) {
      value = value.slice(0, -1);
    } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.TAB) {
      // Tab switches focus between the two fields
      event.preventDefault();
      this.focusedField = isRoomCode ? 'playerName' : 'roomCode';
    } else if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.ENTER) {
      // Enter unfocuses and does nothing else
      this.focusedField = null;
    } else if (event.key && event.key.length === 1 && value.length < maxLen) {
      // Room codes are forced uppercase, letters only
      if (isRoomCode) {
        const ch = event.key.toUpperCase();
        if (/^[A-Z]$/.test(ch)) {
          value += ch;
        }
      } else {
        value += event.key;
      }
    }

    if (isRoomCode) {
      this.roomCode = value;
    } else {
      this.playerName = value;
    }

    this._refreshFields();
  }

  // ───────────────────────────────────────────────────────────
  //  Button helper
  // ───────────────────────────────────────────────────────────

  _createButton(x, y, label, color, onClick) {
    const btnWidth = 140;
    const btnHeight = 46;

    const bg = this.add.rectangle(x, y, btnWidth, btnHeight, color)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y, label, {
      fontSize: '20px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.ComponentToHex(
      Math.min(255, ((color >> 16) & 0xff) + 30),
      Math.min(255, ((color >> 8) & 0xff) + 30),
      Math.min(255, (color & 0xff) + 30),
    )));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', onClick);

    return bg;
  }

  // ───────────────────────────────────────────────────────────
  //  Create / Join logic
  // ───────────────────────────────────────────────────────────

  _validate() {
    if (this.roomCode.length < MIN_ROOM_CODE_LENGTH || this.roomCode.length > MAX_ROOM_CODE_LENGTH) {
      this._setStatus(`Room code must be ${MIN_ROOM_CODE_LENGTH}-${MAX_ROOM_CODE_LENGTH} letters`);
      return false;
    }
    if (this.playerName.trim().length === 0) {
      this._setStatus('Enter a player name');
      return false;
    }
    return true;
  }

  _onCreate() {
    if (this.busy || !this._validate()) return;
    this.busy = true;
    this._setStatus('Connecting...');

    socketClient.connect();
    this._listenForResponse();

    // Small delay to let the socket connect before emitting
    this.time.delayedCall(300, () => {
      this._setStatus('Creating room...');
      socketClient.createRoom(this.roomCode, this.playerName.trim());
    });
  }

  _onJoin() {
    if (this.busy || !this._validate()) return;
    this.busy = true;
    this._setStatus('Connecting...');

    socketClient.connect();
    this._listenForResponse();

    this.time.delayedCall(300, () => {
      this._setStatus('Joining room...');
      socketClient.joinRoom(this.roomCode, this.playerName.trim());
    });
  }

  /** Register one-time listeners for the server response. */
  _listenForResponse() {
    const onCreated = (data) => {
      this._cleanup(onCreated, onJoined, onError);
      this._goToGame({
        roomCode: data.roomCode,
        playerName: this.playerName.trim(),
        castle: data.castle,
        players: [],
      });
    };

    const onJoined = (data) => {
      this._cleanup(onCreated, onJoined, onError);
      this._goToGame({
        roomCode: this.roomCode,
        playerName: this.playerName.trim(),
        castle: data.castle,
        players: data.players || [],
      });
    };

    const onError = (data) => {
      this._cleanup(onCreated, onJoined, onError);
      this.busy = false;
      this._setStatus(data.message || 'Something went wrong');
    };

    socketClient.on('room-created', onCreated);
    socketClient.on('room-joined', onJoined);
    socketClient.on('error', onError);
  }

  _cleanup(onCreated, onJoined, onError) {
    socketClient.off('room-created', onCreated);
    socketClient.off('room-joined', onJoined);
    socketClient.off('error', onError);
  }

  _goToGame(sceneData) {
    this.scene.start('GameScene', sceneData);
  }

  _setStatus(msg) {
    if (this.statusText) {
      this.statusText.setText(msg);
    }
  }
}
