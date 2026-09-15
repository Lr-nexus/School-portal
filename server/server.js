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

const allowedOrigins = (
  process.env.CLIENT_URL ||
  'https://nexus-nexus-1876.vercel.app'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOriginCheck(origin, cb) {
  if (!origin) return cb(null, true);

  if (allowedOrigins.includes(origin)) {
    return cb(null, true);
  }

  return cb(new Error(`CORS blocked: ${origin}`));
}

const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

setupSocket(io);

app.use(cors({
  origin: corsOriginCheck,
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
);

app.get('/', (req, res) => {
  res.json({
    message: 'School Portal API is running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});