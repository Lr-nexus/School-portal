const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { notify } = require('../utils/notify');

router.use(protect);

async function getTeacher(userId) {
  const [rows] = await pool.execute(
    'SELECT id, name, form_class FROM teachers WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
}

/* ============================================================
   TEACHER — Mark attendance for a class + date
   ============================================================ */
router.post('/', allow('teacher'), async (req, res) => {
  const { className, date, entries } = req.body;

  if (!className || !date || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ message: 'className, date and entries are required' });
  }

  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  // Verify the teacher owns this class
  const [classRows] = await pool.execute(
    'SELECT id FROM classes WHERE name = ? AND teacher_id = ?',
    [className, teacher.id]
  );
  if (!classRows.length) {
    return res.status(403).json({ message: 'You do not teach this class' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const e of entries) {
      const status = ['Present', 'Absent', 'Late', 'Excused'].includes(e.status)
        ? e.status
        : 'Present';

      await conn.execute(
        `INSERT INTO attendance (student_id, class_name, teacher_id, date, status, note)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           note = VALUES(note),
           teacher_id = VALUES(teacher_id)`,
        [e.studentId, className, teacher.id, date, status, e.note || null]
      );
    }

    await conn.commit();

    // Notify absentees' guardians? Skip for now.
    res.json({
      message: `Attendance saved for ${entries.length} student(s)`,
      count: entries.length,
      date,
      className,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Save attendance failed:', err);
    res.status(500).json({ message: err.message || 'Failed to save attendance' });
  } finally {
    conn.release();
  }
});

/* ============================================================
   TEACHER — Get attendance for a class + date
   ============================================================ */
router.get('/class/:className', allow('teacher'), async (req, res) => {
  const { className } = req.params;
  const { date } = req.query;

  if (!date) return res.status(400).json({ message: 'date query param required' });

  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const [classRows] = await pool.execute(
    'SELECT id FROM classes WHERE name = ? AND teacher_id = ?',
    [className, teacher.id]
  );
  if (!classRows.length) {
    return res.status(403).json({ message: 'You do not teach this class' });
  }

  // Get all students in the class + their attendance status for the date
  const [rows] = await pool.execute(
    `SELECT
       s.id AS student_id,
       s.name,
       s.admission_no,
       a.status,
       a.note
     FROM students s
     LEFT JOIN attendance a
       ON a.student_id = s.id AND a.date = ?
     WHERE s.class_name = ?
     ORDER BY s.name`,
    [date, className]
  );

  res.json({
    className,
    date,
    entries: rows.map((r) => ({
      studentId: r.student_id,
      name: r.name,
      admissionNo: r.admission_no,
      status: r.status || null,
      note: r.note || '',
    })),
  });
});

/* ============================================================
   TEACHER — attendance summary for a class over a date range
   ============================================================ */
router.get('/summary/:className', allow('teacher'), async (req, res) => {
  const { className } = req.params;
  const { from, to } = req.query;

  const teacher = await getTeacher(req.user.id);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const [classRows] = await pool.execute(
    'SELECT id FROM classes WHERE name = ? AND teacher_id = ?',
    [className, teacher.id]
  );
  if (!classRows.length) {
    return res.status(403).json({ message: 'You do not teach this class' });
  }

  const [rows] = await pool.execute(
    `SELECT
       s.id AS student_id,
       s.name,
       SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
       SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN a.status = 'Excused' THEN 1 ELSE 0 END) AS excused,
       COUNT(a.id) AS total
     FROM students s
     LEFT JOIN attendance a
       ON a.student_id = s.id AND a.date BETWEEN ? AND ?
     WHERE s.class_name = ?
     GROUP BY s.id, s.name
     ORDER BY s.name`,
    [from || '1970-01-01', to || '2100-01-01', className]
  );

  res.json({
    className,
    from: from || null,
    to: to || null,
    students: rows.map((r) => ({
      studentId: r.student_id,
      name: r.name,
      present: Number(r.present || 0),
      absent: Number(r.absent || 0),
      late: Number(r.late || 0),
      excused: Number(r.excused || 0),
      total: Number(r.total || 0),
      percentage: r.total ? Math.round((Number(r.present) / Number(r.total)) * 100) : 0,
    })),
  });
});

/* ============================================================
   STUDENT — Own attendance
   ============================================================ */
router.get('/me', allow('student'), async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT id, class_name FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) return res.json({ records: [], summary: {} });

  const studentId = studentRows[0].id;

  const [records] = await pool.execute(
    `SELECT date, status, note
     FROM attendance WHERE student_id = ?
     ORDER BY date DESC LIMIT 60`,
    [studentId]
  );

  const [[summary]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
       SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) AS excused,
       COUNT(*) AS total
     FROM attendance WHERE student_id = ?`,
    [studentId]
  );

  const total = Number(summary.total || 0);
  const present = Number(summary.present || 0);

  res.json({
    records,
    summary: {
      present,
      absent: Number(summary.absent || 0),
      late: Number(summary.late || 0),
      excused: Number(summary.excused || 0),
      total,
      percentage: total ? Math.round((present / total) * 100) : 0,
    },
  });
});

/* ============================================================
   ADMIN — School-wide attendance summary
   ============================================================ */
router.get('/admin/overview', allow('admin'), async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT
       s.class_name,
       COUNT(DISTINCT s.id) AS students,
       SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
       COUNT(a.id) AS total
     FROM students s
     LEFT JOIN attendance a ON a.student_id = s.id
     GROUP BY s.class_name
     ORDER BY s.class_name`
  );

  res.json(rows.map((r) => ({
    className: r.class_name,
    students: Number(r.students),
    present: Number(r.present || 0),
    absent: Number(r.absent || 0),
    total: Number(r.total || 0),
    percentage: r.total ? Math.round((Number(r.present) / Number(r.total)) * 100) : 0,
  })));
});

module.exports = router;