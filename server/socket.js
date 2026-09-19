/* Socket.IO signaling for WebRTC + participant tracking + raise hand */

const roomParticipants = new Map();
const raisedHands = new Map();

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 socket connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userId, name, role }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = name || 'Guest';
      socket.userRole = role || 'student';
      socket.userId = userId;

      if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Map());
      roomParticipants.get(roomId).set(socket.id, {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.userName,
        role: socket.userRole,
        joinedAt: new Date().toISOString()
      });

      console.log(`👥 ${socket.userName} (${socket.userRole}) joined ${roomId}`);

      const existing = [];
      const room = io.sockets.adapter.rooms.get(roomId) || new Set();
      room.forEach((socketId) => {
        if (socketId !== socket.id) {
          const s = io.sockets.sockets.get(socketId);
          if (s) existing.push({
            socketId,
            userId: s.userId,
            name: s.userName || 'Guest',
            role: s.userRole || 'student'
          });
        }
      });
      socket.emit('existing-users', existing);

      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.userName,
        role: socket.userRole
      });

      const currentHands = Array.from(raisedHands.get(roomId) || []);
      socket.emit('raised-hands-list', currentHands);

      io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));
    });

    socket.on('signal', ({ to, signal, name }) => {
      io.to(to).emit('signal', {
        from: socket.id,
        fromUserId: socket.userId,
        signal,
        name: name || socket.userName || 'Guest'
      });
    });

    socket.on('raise-hand', () => {
      const roomId = socket.roomId;
      if (!roomId) return;

      if (!raisedHands.has(roomId)) raisedHands.set(roomId, new Set());
      raisedHands.get(roomId).add(socket.id);

      console.log(`[HAND] ${socket.userName} raised their hand in ${roomId}`);

      io.to(roomId).emit('hand-raised', {
        socketId: socket.id,
        userId: socket.userId,
        name: socket.userName,
        role: socket.userRole,
        raisedAt: new Date().toISOString()
      });
    });

    socket.on('lower-hand', () => {
      const roomId = socket.roomId;
      if (!roomId) return;

      const set = raisedHands.get(roomId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) raisedHands.delete(roomId);
      }

      console.log(`[HAND] ${socket.userName} lowered their hand in ${roomId}`);

      io.to(roomId).emit('hand-lowered', { socketId: socket.id });
    });

    socket.on('acknowledge-hand', ({ socketId }) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      if (socket.userRole !== 'teacher' && socket.userRole !== 'admin') return;

      const set = raisedHands.get(roomId);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) raisedHands.delete(roomId);
      }

      console.log(`[HAND] ${socket.userName} acknowledged hand from ${socketId}`);

      io.to(socketId).emit('hand-acknowledged', {
        byName: socket.userName
      });

      io.to(roomId).emit('hand-lowered', { socketId });
    });

    socket.on('disconnecting', () => {
      const roomId = socket.roomId;
      if (roomId) {
        const map = roomParticipants.get(roomId);
        if (map) {
          map.delete(socket.id);
          if (map.size === 0) roomParticipants.delete(roomId);
        }

        const hands = raisedHands.get(roomId);
        if (hands) {
          hands.delete(socket.id);
          if (hands.size === 0) raisedHands.delete(roomId);
          io.to(roomId).emit('hand-lowered', { socketId: socket.id });
        }

        socket.to(roomId).emit('user-left', socket.id);
        io.to(roomId).emit('participants-updated', getRoomParticipants(roomId));
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ socket disconnected: ${socket.id}`);
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

function getRaisedHands(roomId) {
  const set = raisedHands.get(roomId);
  if (!set) return [];
  return Array.from(set);
}

module.exports = {
  setupSocket,
  getRoomParticipants,
  getAllRooms,
  getRaisedHands
};