/* ------------------------------------------------------------------
   Socket.IO signaling server for WebRTC + participant + hand tracking
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
        handRaised: false,
        handRaisedAt: null,
        joinedAt: new Date().toISOString()
      });

      console.log(`👥 ${socket.userName} (${socket.userRole}) joined ${roomId}`);

      /* --- Send existing users to the newcomer --- */
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

      /* --- Tell everyone else that someone new arrived --- */
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.userName,
        role: socket.userRole
      });

      /* --- Broadcast updated participants --- */
      io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));

      if (ack) ack({ ok: true, existingCount: existing.length });
    });

    /* ---------------- signal ---------------- */
    socket.on('signal', ({ to, signal, name }) => {
      if (!to || !signal) {
        console.warn('⚠️ signal received without "to" or "signal"');
        return;
      }
      io.to(to).emit('signal', {
        from: socket.id,
        fromUserId: socket.userId,
        signal,
        name: name || socket.userName || 'Guest'
      });
    });

    /* ---------------- raise-hand ----------------
       Only students can raise their hand. Teachers cannot.
    ------------------------------------------------ */
    socket.on('raise-hand', ({ roomId, raised }) => {
      if (socket.userRole !== 'student') {
        console.log(`🚫 teacher tried to raise hand (${socket.userName})`);
        return;
      }
      const map = roomParticipants.get(roomId);
      if (!map) return;
      const me = map.get(socket.id);
      if (!me) return;

      me.handRaised = !!raised;
      me.handRaisedAt = raised ? new Date().toISOString() : null;

      console.log(`✋ ${me.name} ${raised ? 'raised' : 'lowered'} hand`);

      io.to(roomId).emit('hand-raised', {
        socketId: socket.id,
        userId: me.userId,
        name: me.name,
        raised: !!raised
      });

      io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));
    });

    /* ---------------- lower-hand (teacher only) ----------------
       Allows the teacher to dismiss a specific student's raised hand.
    ------------------------------------------------------------ */
    socket.on('lower-hand', ({ roomId, socketId }) => {
      if (socket.userRole !== 'teacher') {
        console.log(`🚫 non-teacher tried to lower hand (${socket.userName})`);
        return;
      }
      const map = roomParticipants.get(roomId);
      if (!map) return;
      const target = map.get(socketId);
      if (!target) return;

      target.handRaised = false;
      target.handRaisedAt = null;

      console.log(`✋ ${socket.userName} lowered hand for ${target.name}`);

      io.to(roomId).emit('hand-raised', {
        socketId,
        userId: target.userId,
        name: target.name,
        raised: false
      });

      io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));
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