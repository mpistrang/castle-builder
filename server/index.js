require('dotenv').config({ path: '.env.local' });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');
const Room = require('./Room');
const Generator = require('./Generator');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const generator = new Generator();

// Serve built client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Track which room each socket is in
const socketRooms = new Map();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ── Create Room ─────────────────────────────────────────
  socket.on('create-room', async ({ roomCode, playerName }) => {
    try {
      const room = await Room.create(roomCode);
      room.addPlayer(socket.id, playerName);
      socket.join(roomCode);
      socketRooms.set(socket.id, roomCode);

      socket.emit('room-created', {
        roomCode,
        castle: room.castle.getGrid(),
      });
      console.log(`Room ${roomCode} created by ${playerName}`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Join Room ───────────────────────────────────────────
  socket.on('join-room', async ({ roomCode, playerName }) => {
    try {
      let room = Room.get(roomCode);
      if (!room) {
        // Try creating if it doesn't exist yet
        room = await Room.create(roomCode);
      }

      const player = room.addPlayer(socket.id, playerName);
      socket.join(roomCode);
      socketRooms.set(socket.id, roomCode);

      // Tell the joining player about the current state
      socket.emit('room-joined', {
        castle: room.castle.getGrid(),
        players: room.getPlayers(),
      });

      // Tell everyone else about the new player
      socket.to(roomCode).emit('player-joined', {
        playerName,
        position: player.position,
      });
      console.log(`${playerName} joined room ${roomCode}`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Build / Destroy Action ──────────────────────────────
  socket.on('action', async ({ position, mode, brushSize }) => {
    const roomCode = socketRooms.get(socket.id);
    if (!roomCode) return;

    const room = Room.get(roomCode);
    if (!room) return;

    if (!room.checkRateLimit(socket.id)) return;

    const size = Math.max(1, Math.min(5, brushSize || 1));
    let changedBlocks;

    if (mode === 'destroy') {
      changedBlocks = room.castle.destroy(position.x, position.y, size);
    } else {
      const newBlocks = generator.generate(room.castle, position.x, position.y, size);
      changedBlocks = room.castle.build(newBlocks);
    }

    if (changedBlocks && changedBlocks.length > 0) {
      // Broadcast immediately — don't wait for Redis persistence
      io.in(roomCode).emit('castle-updated', {
        castle: room.castle.getGrid(),
        action: mode || 'build',
        changedBlocks,
      });
      // Persist in background (fire-and-forget)
      room.save().catch((err) => {
        console.error(`Failed to persist room ${roomCode}:`, err.message);
      });
    }
  });

  // ── Clear All Blocks ──────────────────────────────────
  socket.on('clear', async () => {
    const roomCode = socketRooms.get(socket.id);
    if (!roomCode) return;

    const room = Room.get(roomCode);
    if (!room) return;

    room.castle.clear();
    io.in(roomCode).emit('castle-updated', {
      castle: room.castle.getGrid(),
      action: 'clear',
      changedBlocks: [],
    });
    room.save().catch((err) => {
      console.error(`Failed to persist room ${roomCode}:`, err.message);
    });
  });

  // ── Player Movement ─────────────────────────────────────
  socket.on('move', ({ position }) => {
    const roomCode = socketRooms.get(socket.id);
    if (!roomCode) return;

    const room = Room.get(roomCode);
    if (!room) return;

    room.updatePosition(socket.id, position);
    const playerName = room.getPlayerName(socket.id);

    socket.to(roomCode).emit('player-moved', {
      playerName,
      position,
    });
  });

  // ── Leave Room ──────────────────────────────────────────
  socket.on('leave-room', () => {
    handleLeave(socket);
  });

  // ── Disconnect ──────────────────────────────────────────
  socket.on('disconnect', () => {
    handleLeave(socket);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

async function handleLeave(socket) {
  const roomCode = socketRooms.get(socket.id);
  if (!roomCode) return;

  const room = Room.get(roomCode);
  if (room) {
    const playerName = room.getPlayerName(socket.id);
    await room.removePlayer(socket.id);

    socket.to(roomCode).emit('player-left', { playerName });
  }

  socket.leave(roomCode);
  socketRooms.delete(socket.id);
}

server.listen(config.PORT, () => {
  console.log(`Castle Builder server running on port ${config.PORT}`);
});
