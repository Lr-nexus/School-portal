const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getRoomParticipants, getAllRooms } = require('../socket');
const { notifyClassStudents } = require('../utils/notify');
const { getTeacherContext, canTeach } = require('../utils/teacherContext');

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
  return rows[0] || null;
}

/**
 * Pick a class + subject for a new live session.
 * Priority:
 *   1. What the request explicitly asks for
 *   2. The teacher's form class (with whatever subject they choose)
 *   3. The teacher's first assignment
 */
function resolveTarget(ctx, requestedClass, requestedSubject) {
  let className = requestedClass;
  let subject = requestedSubject;

  if (!className) {
    if (ctx.formClass) {
      className = ctx.formClass;
    } else if (ctx.assignments.length > 0) {
      className = ctx.assignments[0].className;
      if (!subject) subject = ctx.assignments[0].subject;
    }
  }

  if (!subject) subject = 'General';

  // Verify
  if (className && !canTeach(ctx, className, subject)) {
    // Try to fix the subject by finding one the teacher actually teaches in this class
    const fallback = ctx.assignments.find((a) => a.className === className);
    if (fallback) subject = fallback.subject;
  }

  return { className, subject };
}

/* ==========================================================
   ADMIN — monitor all live classes across the school
   ========================================================== */
router.get('/admin/active', allow('admin'), async (req, res) => {
  const allRooms = getAllRooms();
  const [live] = await pool.execute(
    "SELECT * FROM class_sessions WHERE status = 'live'"
  );
  res.json(
    live.map((s) => ({
      ...s,
      participants: allRooms[s.room_id] || [],
    }))
  );
});

router.get('/admin/sessions/:id/participants', allow('admin'), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ?',
    [req.params.id]
  );
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
    const ctx = await getTeacherContext(req.user.id);
    if (!ctx) return res.json([]);

    const classSet = new Set();
    if (ctx.formClass) classSet.add(ctx.formClass);
    ctx.assignments.forEach((a) => classSet.add(a.className));

    if (!classSet.size) return res.json([]);

    const list = Array.from(classSet);
    const ph = list.map(() => '?').join(',');
    query += ` WHERE class_name IN (${ph}) OR teacher_id = ?`;
    params.push(...list, ctx.teacherId);
  }
  /* ADMIN: sees everything */

  const [sessions] = await pool.execute(query, params);

  const sorted = sessions
    .map((s) => ({
      id: s.id,
      teacherId: s.teacher_id,
      teacherName: s.teacher_name || 'Teacher',
      title: s.title,
      subject: s.subject,
      className: s.class_name,
      description: s.description,
      startTime: s.start_time,
      endTime: s.end_time,
      status: s.status,
      roomId: s.room_id,
      participants: getRoomParticipants(s.room_id),
    }))
    .sort((a, b) => {
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

  const s = rows[0];
  res.json({
    id: s.id,
    roomId: s.room_id,
    title: s.title,
    subject: s.subject,
    className: s.class_name,
    description: s.description,
    teacherId: s.teacher_id,
    teacherName: s.teacher_name || 'Teacher',
    startTime: s.start_time,
    endTime: s.end_time,
    status: s.status,
  });
});

router.get('/sessions/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Session not found' });
  res.json(rows[0]);
});

/* ==========================================================
   TEACHER — plan a class for later (scheduled)
   ========================================================== */
router.post('/sessions', allow('teacher'), async (req, res) => {
  const { title, subject, description, startTime, endTime, className } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const { className: targetClass, subject: targetSubject } = resolveTarget(ctx, className, subject);

  if (!targetClass) {
    return res.status(400).json({
      message: 'You have no class assigned. Contact the admin.',
    });
  }
  if (!canTeach(ctx, targetClass, targetSubject)) {
    return res.status(403).json({
      message: `You are not assigned to teach ${targetSubject} in ${targetClass}`,
    });
  }

  const roomId = makeRoomId(title, targetClass);

  const [result] = await pool.execute(
    `INSERT INTO class_sessions
       (teacher_id, teacher_name, title, subject, class_name, description,
        start_time, end_time, status, room_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    [
      ctx.teacherId,
      ctx.name,
      title,
      targetSubject,
      targetClass,
      description || '',
      startTime || new Date().toISOString(),
      endTime || new Date(Date.now() + 3600000).toISOString(),
      roomId,
    ]
  );

  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ?',
    [result.insertId]
  );
  res.status(201).json({ message: 'Class scheduled', session: rows[0] });
});

/* ==========================================================
   TEACHER — start a class RIGHT NOW
   ========================================================== */
router.post('/sessions/now', allow('teacher'), async (req, res) => {
  const { title, subject, description, duration, className } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const { className: targetClass, subject: targetSubject } = resolveTarget(ctx, className, subject);

  if (!targetClass) {
    return res.status(400).json({
      message: 'You have no class assigned. Contact the admin.',
    });
  }
  if (!canTeach(ctx, targetClass, targetSubject)) {
    return res.status(403).json({
      message: `You are not assigned to teach ${targetSubject} in ${targetClass}`,
    });
  }

  const minutes = Number(duration) || 60;
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);
  const roomId = makeRoomId(title, targetClass);

  const [result] = await pool.execute(
    `INSERT INTO class_sessions
      (teacher_id, teacher_name, title, subject, class_name, description,
       start_time, end_time, status, room_id, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live', ?, NOW())`,
    [
      ctx.teacherId,
      ctx.name,
      title,
      targetSubject,
      targetClass,
      description || '',
      startTime,
      endTime,
      roomId,
    ]
  );

  await notifyClassStudents(targetClass, {
    type: 'live_class',
    title: 'Live class started',
    body: `${ctx.name} started "${title}"`,
    link: '/student/classroom',
  });

  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ?',
    [result.insertId]
  );

  res.status(201).json({
    message: 'Live class started',
    session: rows[0],
  });
});

/* ==========================================================
   TEACHER — start a previously scheduled session
   ========================================================== */
router.post('/sessions/:id/start', allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
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
    body: `${ctx.name} started "${rows[0].title}"`,
    link: '/student/classroom',
  });

  const [updated] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ?',
    [req.params.id]
  );
  res.json({ message: 'Class started', session: updated[0] });
});

/* ==========================================================
   TEACHER — end a session
   ========================================================== */
router.post('/sessions/:id/end', allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Session not found' });

  await pool.execute(
    "UPDATE class_sessions SET status = 'ended', ended_at = NOW() WHERE id = ?",
    [req.params.id]
  );

  const [updated] = await pool.execute(
    'SELECT * FROM class_sessions WHERE id = ?',
    [req.params.id]
  );
  res.json({ message: 'Class ended', session: updated[0] });
});

/* ==========================================================
   TEACHER — delete a session
   ========================================================== */
router.delete('/sessions/:id', allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  await pool.execute(
    'DELETE FROM class_sessions WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );

  res.json({ message: 'Session deleted' });
});

module.exports = router;