const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getRoomParticipants, getAllRooms } = require('../socket');
const { notifyClassStudents } = require('../utils/notify');

router.use(protect);

function makeRoomId(title, className) {
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
  const cls = String(className).toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${slug}-${cls}-${Date.now()}`;
}

async function getTeacher(userId) {
  const [rows] = await pool.execute(
    'SELECT id, name, form_class FROM teachers WHERE user_id = ?',
    [userId]
  );
  if (!rows.length) return null;
  return rows[0];
}

/* ==========================================================
   ADMIN-ONLY MONITOR ROUTES
   ========================================================== */

router.get('/admin/active', allow('admin'), async (req, res) => {
  const allRooms = getAllRooms();
  const [live] = await pool.execute("SELECT * FROM class_sessions WHERE status = 'live'");
  res.json(live.map((s) => ({ ...s, participants: allRooms[s.room_id] || [] })));
});

router.get('/admin/sessions/:id/participants', allow('admin'), async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM class_sessions WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Session not found' });
  res.json(getRoomParticipants(rows[0].room_id));
});

/* ==========================================================
   SHARED READ ROUTES
   ========================================================== */

router.get('/sessions', async (req, res) => {
  let query = 'SELECT * FROM class_sessions';
  const params = [];

  if (req.user.role === 'student') {
    const [rows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.json([]);
    query += ' WHERE class_name = ?';
    params.push(rows[0].class_name);
  } else if (req.user.role === 'teacher') {
    const teacher = await getTeacher(req.user.id);
    if (!teacher) return res.json([]);
    query += ' WHERE teacher_id = ?';
    params.push(teacher.id);
  }

  const [sessions] = await pool.execute(query, params);

  const sorted = sessions.map((s) => ({
    id: s.id, teacherId: s.teacher_id, title: s.title, subject: s.subject,
    className: s.class_name, description: s.description,
    startTime: s.start_time, endTime: s.end_time, status: s.status,
    roomId: s.room_id,
    participants: getRoomParticipants(s.room_id),
  })).sort((a, b) => {
    const order = { live: 0, scheduled: 1, ended: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.startTime) - new Date(b.startTime);
  });

  res.json(sorted);
});

router.get('/rooms/:roomId', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE room_id = ?',
    [req.params.roomId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Room not found' });
  if (rows[0].status !== 'live') {
    return res.status(400).json({ message: 'This class is not live yet' });
  }
  res.json(rows[0]);
});

router.get('/sessions/:id', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM class_sessions WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Session not found' });
  res.json(rows[0]);
});

/* ==========================================================
   TEACHER — plan a class
   ⭐ class_name is FORCED from the teacher's profile.
   ========================================================== */
router.post('/sessions', allow('teacher'), async (req, res) => {
  const { title, subject, description, startTime, endTime } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  if (!teacher.form_class) {
    return res.status(400).json({ message: 'You have no class assigned. Contact the admin.' });
  }

  const roomId = makeRoomId(title, teacher.form_class);

  const [result] = await pool.execute(
    `INSERT INTO class_sessions (teacher_id, title, subject, class_name, description, start_time, end_time, status, room_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    [
      teacher.id,
      title,
      subject || 'General',
      teacher.form_class, // ⭐ forced
      description || '',
      startTime || new Date().toISOString(),
      endTime || new Date(Date.now() + 3600000).toISOString(),
      roomId,
    ]
  );

  const [rows] = await pool.execute('SELECT * FROM class_sessions WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Class scheduled', session: rows[0] });
});

/* ---------- TEACHER — start a class ---------- */
router.post('/sessions/:id/start', allow('teacher'), async (req, res) => {
  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, teacher.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Session not found' });
  if (rows[0].status === 'ended') {
    return res.status(400).json({ message: 'This session has already ended' });
  }

  await pool.execute(
    "UPDATE class_sessions SET status = 'live', started_at = NOW() WHERE id = ?",
    [req.params.id]
  );

  await notifyClassStudents(rows[0].class_name, {
    type: 'live_class',
    title: 'Live class started',
    body: `${teacher.name} started "${rows[0].title}"`,
    link: '/student/classroom',
  });

  const [updated] = await pool.execute('SELECT * FROM class_sessions WHERE id = ?', [req.params.id]);
  res.json({ message: 'Class started', session: updated[0] });
});

router.post('/sessions/:id/end', allow('teacher'), async (req, res) => {
  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, teacher.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Session not found' });

  await pool.execute(
    "UPDATE class_sessions SET status = 'ended', ended_at = NOW() WHERE id = ?",
    [req.params.id]
  );

  const [updated] = await pool.execute('SELECT * FROM class_sessions WHERE id = ?', [req.params.id]);
  res.json({ message: 'Class ended', session: updated[0] });
});

router.delete('/sessions/:id', allow('teacher'), async (req, res) => {
  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  await pool.execute(
    'DELETE FROM class_sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, teacher.id]
  );

  res.json({ message: 'Session deleted' });
});

module.exports = router;