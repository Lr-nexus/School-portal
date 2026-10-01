const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect);

async function getTeacher(userId) {
  const [rows] = await pool.execute(
    'SELECT id, name, form_class FROM teachers WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
}

/* ============================================================
   GET timetable for a class
   - Students see their own class; anything else returns 403.
   - Teachers and admins can view ANY class timetable.
   - Everyone else (parents) can view any class too.
   ============================================================ */
router.get('/class/:className', async (req, res) => {
  const className = req.params.className;

  /* Only students are restricted to their own class */
  if (req.user.role === 'student') {
    const [sRows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (!sRows.length) {
      return res.status(404).json({ message: 'Student record not found' });
    }
    if (sRows[0].class_name !== className) {
      return res.status(403).json({
        message: `You are in ${sRows[0].class_name}, not ${className}`,
      });
    }
  }

  const [rows] = await pool.execute(
    `SELECT t.*, te.name AS teacher_name
     FROM timetables t
     LEFT JOIN teachers te ON te.id = t.teacher_id
     WHERE t.class_name = ?
     ORDER BY
       FIELD(t.day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
       t.period`,
    [className]
  );

  res.json({
    className,
    slots: rows.map((r) => ({
      id: r.id,
      day: r.day,
      period: r.period,
      startTime: r.start_time,
      endTime: r.end_time,
      subject: r.subject,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name || '—',
    })),
  });
});

/* ============================================================
   TEACHER — Save full timetable for a class (replace-all)
   Only the class's form teacher (or an admin) can save it.
   ============================================================ */
router.post('/class/:className', allow('teacher'), async (req, res) => {
  const className = req.params.className;
  const { slots } = req.body;

  if (!Array.isArray(slots)) {
    return res.status(400).json({ message: 'slots array is required' });
  }

  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const [classRows] = await pool.execute(
    'SELECT id FROM classes WHERE name = ? AND teacher_id = ?',
    [className, teacher.id]
  );
  if (!classRows.length) {
    return res.status(403).json({ message: 'You do not own this class' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute('DELETE FROM timetables WHERE class_name = ?', [className]);

    for (const s of slots) {
      if (!s.day || !s.subject) continue;
      await conn.execute(
        `INSERT INTO timetables
          (class_name, day, period, start_time, end_time, subject, teacher_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          className,
          s.day,
          Number(s.period) || 1,
          s.startTime || '',
          s.endTime || '',
          s.subject,
          teacher.id,
        ]
      );
    }

    await conn.commit();

    /* Notify the class */
    const [studentUsers] = await pool.execute(
      'SELECT user_id FROM students WHERE class_name = ? AND user_id IS NOT NULL',
      [className]
    );
    const { notify } = require('../utils/notify');
    for (const su of studentUsers) {
      await notify({
        userId: su.user_id,
        type: 'timetable',
        title: 'Timetable updated',
        body: `Your class timetable for ${className} has been updated`,
        link: '/student/timetable',
      });
    }

    res.json({
      message: 'Timetable saved',
      count: slots.length,
      className,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Save timetable failed:', err);
    res.status(500).json({ message: err.message || 'Failed to save timetable' });
  } finally {
    conn.release();
  }
});

module.exports = router;