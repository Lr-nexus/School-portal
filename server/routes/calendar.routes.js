const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect);

/* ============================================================
   GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
   ============================================================ */
router.get('/', async (req, res) => {
  const from = req.query.from || new Date().toISOString().split('T')[0];
  const to = req.query.to || new Date(Date.now() + 60 * 24 * 3600000).toISOString().split('T')[0];

  const role = req.user.role;
  const userId = req.user.id;
  const events = [];

  try {
    /* ---------- CLASS SESSIONS ---------- */
    let sessionQuery = `SELECT * FROM class_sessions
      WHERE DATE(start_time) BETWEEN ? AND ?`;
    const sessionParams = [from, to];

    if (role === 'student') {
      const [sRows] = await pool.execute(
        'SELECT class_name FROM students WHERE user_id = ?',
        [userId]
      );
      if (sRows.length) {
        sessionQuery += ' AND class_name = ?';
        sessionParams.push(sRows[0].class_name);
      }
    } else if (role === 'teacher') {
      const [tRows] = await pool.execute(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      if (tRows.length) {
        sessionQuery += ' AND teacher_id = ?';
        sessionParams.push(tRows[0].id);
      }
    }

    const [sessions] = await pool.execute(sessionQuery, sessionParams);
    sessions.forEach((s) => events.push({
      id: `session-${s.id}`,
      title: s.title,
      date: s.start_time,
      endDate: s.end_time,
      type: 'class',
      color: '#dc2626',
      meta: `${s.subject} · ${s.class_name}`,
      link: null,
    }));

    /* ---------- ASSIGNMENT DUE DATES ---------- */
    let assignQuery = `SELECT * FROM assignments
      WHERE due_date BETWEEN ? AND ?`;
    const assignParams = [from, to];

    if (role === 'student') {
      const [sRows] = await pool.execute(
        'SELECT class_name FROM students WHERE user_id = ?',
        [userId]
      );
      if (sRows.length) {
        assignQuery += ' AND class_name = ?';
        assignParams.push(sRows[0].class_name);
      }
    } else if (role === 'teacher') {
      const [tRows] = await pool.execute(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      if (tRows.length) {
        assignQuery += ' AND teacher_id = ?';
        assignParams.push(tRows[0].id);
      }
    }

    const [assignments] = await pool.execute(assignQuery, assignParams);
    assignments.forEach((a) => events.push({
      id: `assign-${a.id}`,
      title: a.title,
      date: a.due_date,
      type: 'assignment',
      color: '#16a34a',
      meta: `Assignment · ${a.subject} · ${a.class_name}`,
      link: role === 'student' ? '/student/assignments' : '/teacher/assignments',
    }));

    /* ---------- QUIZ DUE DATES ---------- */
    let quizQuery = `SELECT * FROM quizzes WHERE due_date BETWEEN ? AND ?`;
    const quizParams = [from, to];

    if (role === 'student') {
      const [sRows] = await pool.execute(
        'SELECT class_name FROM students WHERE user_id = ?',
        [userId]
      );
      if (sRows.length) {
        quizQuery += ' AND class_name = ?';
        quizParams.push(sRows[0].class_name);
      }
    } else if (role === 'teacher') {
      const [tRows] = await pool.execute(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      if (tRows.length) {
        quizQuery += ' AND teacher_id = ?';
        quizParams.push(tRows[0].id);
      }
    }

    const [quizzes] = await pool.execute(quizQuery, quizParams);
    quizzes.forEach((q) => events.push({
      id: `quiz-${q.id}`,
      title: q.title,
      date: q.due_date,
      type: 'quiz',
      color: '#0891b2',
      meta: `Quiz · ${q.subject} · ${q.class_name}`,
      link: role === 'student' ? '/student/lms' : '/teacher/lms',
    }));

    /* ---------- ANNOUNCEMENTS ---------- */
    const [anns] = await pool.execute(
      'SELECT * FROM announcements WHERE date BETWEEN ? AND ?',
      [from, to]
    );
    anns.forEach((a) => events.push({
      id: `ann-${a.id}`,
      title: a.title,
      date: a.date,
      type: 'announcement',
      color: '#7c3aed',
      meta: `Announcement · ${a.category || 'General'}`,
      link: `/${role}/announcements`,
    }));

    /* ---------- CUSTOM CALENDAR EVENTS (admin & teacher) ---------- */
    const [customEvents] = await pool.execute(
      `SELECT * FROM calendar_events
       WHERE date BETWEEN ? AND ?
         AND (audience = 'all' OR audience = ?)
       ORDER BY date`,
      [from, to, role]
    );
    customEvents.forEach((e) => events.push({
      id: `event-${e.id}`,
      title: e.title,
      date: e.date,
      endDate: e.end_date,
      type: 'event',
      color: '#f59e0b',
      meta: `${e.category} · ${e.description || ''}`.trim(),
      link: null,
    }));

    res.json({ from, to, events });
  } catch (err) {
    console.error('Calendar fetch failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load calendar' });
  }
});

/* ============================================================
   ADMIN / TEACHER — Create a custom calendar event
   ============================================================ */
router.post('/events', allow('admin', 'teacher'), async (req, res) => {
  const { title, description, date, endDate, category, audience } = req.body;

  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required' });
  }

  const [result] = await pool.execute(
    `INSERT INTO calendar_events
      (title, description, date, end_date, category, audience, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description || '',
      date,
      endDate || null,
      category || 'Event',
      audience || 'all',
      req.user.id,
    ]
  );

  const [rows] = await pool.execute(
    'SELECT * FROM calendar_events WHERE id = ?',
    [result.insertId]
  );
  res.status(201).json({ message: 'Event created', event: rows[0] });
});

/* ============================================================
   ADMIN / TEACHER — Delete a custom calendar event
   - admin can delete any
   - teacher can only delete events they created
   ============================================================ */
router.delete('/events/:id', allow('admin', 'teacher'), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT created_by FROM calendar_events WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) {
    return res.status(404).json({ message: 'Event not found' });
  }

  if (req.user.role === 'teacher' && rows[0].created_by !== req.user.id) {
    return res.status(403).json({ message: 'You can only delete your own events' });
  }

  await pool.execute('DELETE FROM calendar_events WHERE id = ?', [req.params.id]);
  res.json({ message: 'Event deleted' });
});

module.exports = router;