/* ------------------------------------------------------------------
   Socket.IO signaling server for WebRTC + participant tracking
------------------------------------------------------------------- */

const roomParticipants = new Map(); // roomId -> Map<socketId, info>

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 socket connected: ${socket.id}`);

    /* ---------------- join-room ---------------- */
    socket.on('join-room', ({ roomId, userId, name, role }, ack) => {
      if (!roomId) {
        if (ack) ack({ error: 'roomId is required' });
        return;
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = name || 'Guest';
      socket.userRole = role || 'student';
      socket.userId = userId;

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Map());
      }
      roomParticipants.get(roomId).set(socket.id, {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.userName,
        role: socket.userRole,
        joinedAt: new Date().toISOString()
      });

      console.log(`👥 ${socket.userName} (${socket.userRole}) joined ${roomId}`);

      // Send existing users to the newcomer
      const existing = [];
      const room = io.sockets.adapter.rooms.get(roomId) || new Set();
      room.forEach((socketId) => {
        if (socketId !== socket.id) {
          const s = io.sockets.sockets.get(socketId);
          if (s) {
            existing.push({
              socketId,
              userId: s.userId,
              name: s.userName || 'Guest',
              role: s.userRole || 'student'
            });
          }
        }
      });
      socket.emit('existing-users', existing);
      console.log(`📤 Sent ${existing.length} existing user(s) to ${socket.userName}`);

      // Tell everyone else that someone new arrived
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.userName,
        role: socket.userRole
      });

      // Broadcast updated participants
      io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));

      if (ack) ack({ ok: true, existingCount: existing.length });
    });

    /* ---------------- signal ---------------- */
    socket.on('signal', ({ to, signal, name }) => {
      if (!to || !signal) {
        console.warn('⚠️ signal received without "to" or "signal"');
        return;
      }
      console.log(`🔀 signal: ${socket.userName} → ${to}`);
      io.to(to).emit('signal', {
        from: socket.id,
        fromUserId: socket.userId,
        signal,
        name: name || socket.userName || 'Guest'
      });
    });

    /* ---------------- disconnecting ---------------- */
    socket.on('disconnecting', () => {
      const roomId = socket.roomId;
      if (roomId) {
        const map = roomParticipants.get(roomId);
        if (map) {
          map.delete(socket.id);
          if (map.size === 0) roomParticipants.delete(roomId);
        }
        socket.to(roomId).emit('user-left', socket.id);
        io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ socket disconnected: ${socket.id} (${reason})`);
    });
  });
}

function getRoomParticipants(roomId) {
  const map = roomParticipants.get(roomId);
  if (!map) return [];
  return Array.from(map.values());
}

function getAllRooms() {
  const result = {};
  roomParticipants.forEach((map, roomId) => {
    result[roomId] = Array.from(map.values());
  });
  return result;
}

module.exports = { setupSocket, getRoomParticipants, getAllRooms };