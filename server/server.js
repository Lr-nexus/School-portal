const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const teacherRoutes = require('./routes/teacher.routes');
const adminRoutes = require('./routes/admin.routes');
const lmsRoutes = require('./routes/lms.routes');
const classroomRoutes = require('./routes/classroom.routes');
const notesRoutes = require('./routes/notes.routes');
const assignmentsRoutes = require('./routes/assignments.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const { setupSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

/* ============================================================
   CORS — allow the deployed frontend
   ============================================================ */

const allowedOrigins = [
  'https://nexus-nexus-1876.vercel.app',
  'https://school-portal-unva.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001'
];

function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  console.log(`❌ CORS blocked: ${origin}`);
  return callback(new Error('Not allowed by CORS'));
}

const corsOptions = {
  origin: corsOriginCheck,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id']
};

/* ============================================================
   SOCKET.IO — permissive CORS so WebSockets connect
   ============================================================ */

const io = new Server(server, {
  cors: {
    origin: '*',           // ⭐ Socket.IO needs to accept any origin for WS
    credentials: false,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

setupSocket(io);

/* ============================================================
   MIDDLEWARE
   ============================================================ */

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ message: 'School Portal API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));