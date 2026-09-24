const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const authRoutes           = require('./routes/auth.routes');
const studentRoutes        = require('./routes/student.routes');
const teacherRoutes        = require('./routes/teacher.routes');
const adminRoutes          = require('./routes/admin.routes');
const lmsRoutes            = require('./routes/lms.routes');
const classroomRoutes      = require('./routes/classroom.routes');
const notesRoutes          = require('./routes/notes.routes');
const assignmentsRoutes    = require('./routes/assignments.routes');
const notificationsRoutes  = require('./routes/notifications.routes');
const searchRoutes         = require('./routes/search.routes');
const announcementsRoutes  = require('./routes/announcements.routes');
const uploadsRoutes        = require('./routes/uploads.routes');
const parentsRoutes        = require('./routes/parents.routes');
const reportsRoutes        = require('./routes/reports.routes');
const messagesRoutes       = require('./routes/messages.routes');
const discussionsRoutes    = require('./routes/discussions.routes');
const analyticsRoutes      = require('./routes/analytics.routes');
const passwordResetRoutes  = require('./routes/passwordReset.routes');
const smsRoutes            = require('./routes/sms.routes');
const { setupSocket }      = require('./socket');

const app = express();
const server = http.createServer(app);

/* ============================================================
   CORS
   ============================================================ */

const allowedOrigins = [
  'https://nexus-nexus-1876.vercel.app',
  'https://school-portal-1-xaio.onrender.com',
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
   SOCKET.IO
   ============================================================ */

const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
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

app.get('/', (req, res) =>
  res.json({ message: 'School Portal API is running' })
);

/* ============================================================
   ROUTES
   ============================================================ */

app.use('/api/auth',           authRoutes);
app.use('/api/students',       studentRoutes);
app.use('/api/teachers',       teacherRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/lms',            lmsRoutes);
app.use('/api/classroom',      classroomRoutes);
app.use('/api/notes',          notesRoutes);
app.use('/api/assignments',    assignmentsRoutes);
app.use('/api/notifications',  notificationsRoutes);
app.use('/api/search',         searchRoutes);
app.use('/api/announcements',  announcementsRoutes);
app.use('/api/uploads',        uploadsRoutes);
app.use('/api/parents',        parentsRoutes);
app.use('/api/reports',        reportsRoutes);
app.use('/api/messages',       messagesRoutes);
app.use('/api/discussions',    discussionsRoutes);
app.use('/api/analytics',      analyticsRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/sms',            smsRoutes);

app.use((req, res) =>
  res.status(404).json({ message: 'Route not found' })
);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);