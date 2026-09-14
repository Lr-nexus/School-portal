const router = require('express').Router();
const { classSessions, students, teachers, nextId } = require('../data/db');
const { protect, allow } = require('../middleware/auth');
const { getRoomParticipants, getAllRooms } = require('../socket');
const { notifyClassStudents } = require('../utils/notify');

router.use(protect);

function makeRoomId(title, className) {
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
  const cls = String(className).toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${slug}-${cls}-${Date.now()}`;
}

/* ==================================================================
   ADMIN-ONLY MONITOR ROUTES
================================================================== */

// GET /api/classroom/admin/active — every room currently live
router.get('/admin/active', allow('admin'), (req, res) => {
  const allRooms = getAllRooms();
  const live = classSessions
    .filter((s) => s.status === 'live')
    .map((s) => ({
      ...s,
      participants: allRooms[s.roomId] || []
    }));
  res.json(live);
});

// GET /api/classroom/admin/sessions/:id/participants
router.get('/admin/sessions/:id/participants', allow('admin'), (req, res) => {
  const session = classSessions.find((s) => s.id === Number(req.params.id));
  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json(getRoomParticipants(session.roomId));
});

/* ==================================================================
   SHARED READ ROUTES (student, teacher, admin all pass)
================================================================== */

// GET /api/classroom/sessions — role-filtered list
router.get('/sessions', (req, res) => {
  let list = classSessions;

  if (req.user.role === 'student') {
    const student = students.find((s) => s.id === req.user.profileId);
    list = classSessions.filter((s) => s.className === student?.className);
  } else if (req.user.role === 'teacher') {
    list = classSessions.filter((s) => s.teacherId === req.user.profileId);
  }
  // admin: sees everything

  const withParticipants = list.map((s) => ({
    ...s,
    participants: getRoomParticipants(s.roomId)
  }));

  const sorted = withParticipants.sort((a, b) => {
    const order = { live: 0, scheduled: 1, ended: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.startTime) - new Date(b.startTime);
  });

  res.json(sorted);
});

// GET /api/classroom/rooms/:roomId — verify a room is live (used by VideoRoom)
router.get('/rooms/:roomId', (req, res) => {
  const session = classSessions.find((s) => s.roomId === req.params.roomId);
  if (!session) return res.status(404).json({ message: 'Room not found' });
  if (session.status !== 'live') {
    return res.status(400).json({ message: 'This class is not live yet' });
  }
  res.json(session);
});

// GET /api/classroom/sessions/:id — must be declared AFTER /rooms/:roomId
router.get('/sessions/:id', (req, res) => {
  const session = classSessions.find((s) => s.id === Number(req.params.id));
  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json(session);
});

/* ==================================================================
   TEACHER-ONLY ACTION ROUTES
================================================================== */

// POST /api/classroom/sessions — plan a class
router.post('/sessions', allow('teacher'), (req, res) => {
  const { title, subject, className, description, startTime, endTime } = req.body;

  if (!title || !className) {
    return res.status(400).json({ message: 'Title and class are required' });
  }

  const teacher = teachers.find((t) => t.id === req.user.profileId);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const session = {
    id: nextId(classSessions),
    teacherId: teacher.id,
    teacherName: teacher.name,
    title,
    subject: subject || teacher.subjects[0] || 'General',
    className,
    description: description || '',
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    roomId: makeRoomId(title, className)
  };

  classSessions.push(session);
  res.status(201).json({ message: 'Class scheduled', session });
});

// POST /api/classroom/sessions/:id/start — teacher goes live (notifies students)
router.post('/sessions/:id/start', allow('teacher'), (req, res) => {
  const session = classSessions.find(
    (s) => s.id === Number(req.params.id) && s.teacherId === req.user.profileId
  );
  if (!session) return res.status(404).json({ message: 'Session not found' });
  if (session.status === 'ended') {
    return res.status(400).json({ message: 'This session has already ended' });
  }

  session.status = 'live';
  session.startedAt = new Date().toISOString();

  // 📣 Notify every student in this class
  notifyClassStudents(session.className, {
    type: 'live_class',
    title: 'Live class started',
    body: `${session.teacherName} started "${session.title}"`,
    link: '/student/classroom'
  });

  res.json({ message: 'Class started', session });
});

// POST /api/classroom/sessions/:id/end
router.post('/sessions/:id/end', allow('teacher'), (req, res) => {
  const session = classSessions.find(
    (s) => s.id === Number(req.params.id) && s.teacherId === req.user.profileId
  );
  if (!session) return res.status(404).json({ message: 'Session not found' });

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  res.json({ message: 'Class ended', session });
});

// DELETE /api/classroom/sessions/:id
router.delete('/sessions/:id', allow('teacher'), (req, res) => {
  const idx = classSessions.findIndex(
    (s) => s.id === Number(req.params.id) && s.teacherId === req.user.profileId
  );
  if (idx === -1) return res.status(404).json({ message: 'Session not found' });

  classSessions.splice(idx, 1);
  res.json({ message: 'Session deleted' });
});

module.exports = router;