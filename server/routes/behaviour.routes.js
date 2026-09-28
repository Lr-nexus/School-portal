const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { notify } = require('../utils/notify');

router.use(protect);

/* ============================================================
   TEACHER — log a behaviour note
   POST /api/behaviour
   body: { studentId, type, title, note, date }
   ============================================================ */
router.post('/', allow('teacher'), async (req, res) => {
  const { studentId, type, title, note, date } = req.body;

  if (!studentId || !title) {
    return res.status(400).json({ message: 'studentId and title are required' });
  }
  const validType = ['positive', 'negative', 'neutral'].includes(type)
    ? type : 'positive';

  const [tRows] = await pool.execute(
    'SELECT id, name FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!tRows.length) return res.status(404).json({ message: 'Teacher not found' });
  const teacher = tRows[0];

  // Verify the student is in a class this teacher owns
  const [studentRows] = await pool.execute(
    `SELECT s.id, s.name, s.class_name, s.user_id, s.parent_id
     FROM students s
     WHERE s.id = ?`,
    [studentId]
  );
  if (!studentRows.length) {
    return res.status(404).json({ message: 'Student not found' });
  }
  const student = studentRows[0];

  const [clsRows] = await pool.execute(
    'SELECT id FROM classes WHERE name = ? AND teacher_id = ?',
    [student.class_name, teacher.id]
  );
  if (!clsRows.length) {
    return res.status(403).json({ message: 'You do not teach this student' });
  }

  const [result] = await pool.execute(
    `INSERT INTO behaviour_reports
       (student_id, teacher_id, type, title, note, date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      studentId, teacher.id, validType, title.trim(),
      String(note || '').trim(),
      date || new Date().toISOString().split('T')[0],
    ]
  );

  // Notify student + parent
  try {
    if (student.user_id) {
      await notify({
        userId: student.user_id,
        type: 'behaviour',
        title: validType === 'positive' ? 'New positive note' : 'New behaviour note',
        body: `${teacher.name}: ${title}`,
        link: '/student/home',
      });
    }
    if (student.parent_id) {
      const [pRows] = await pool.execute(
        'SELECT user_id FROM parents WHERE id = ?',
        [student.parent_id]
      );
      if (pRows.length && pRows[0].user_id) {
        await notify({
          userId: pRows[0].user_id,
          type: 'behaviour',
          title: `${student.name} — behaviour update`,
          body: `${teacher.name}: ${title}`,
          link: '/parent/behaviour',
        });
      }
    }
  } catch (e) {
    console.error('Notify failed:', e.message);
  }

  const [created] = await pool.execute(
    `SELECT * FROM behaviour_reports WHERE id = ?`,
    [result.insertId]
  );
  res.status(201).json({ message: 'Note logged', report: created[0] });
});

/* ============================================================
   TEACHER — list all my behaviour notes
   GET /api/behaviour/mine
   ============================================================ */
router.get('/mine', allow('teacher'), async (req, res) => {
  const [tRows] = await pool.execute(
    'SELECT id FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!tRows.length) return res.json([]);

  const [rows] = await pool.execute(
    `SELECT br.*, s.name AS student_name, s.admission_no, s.class_name
     FROM behaviour_reports br
     JOIN students s ON s.id = br.student_id
     WHERE br.teacher_id = ?
     ORDER BY br.date DESC, br.id DESC`,
    [tRows[0].id]
  );

  res.json(rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    note: r.note,
    date: r.date,
    createdAt: r.created_at,
    student: {
      id: r.student_id,
      name: r.student_name,
      admissionNo: r.admission_no,
      className: r.class_name,
    },
  })));
});

/* ============================================================
   TEACHER — students in my class (for the "add note" dropdown)
   GET /api/behaviour/students
   ============================================================ */
router.get('/students', allow('teacher'), async (req, res) => {
  const [tRows] = await pool.execute(
    'SELECT id, form_class FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!tRows.length) return res.json([]);

  const [classRows] = await pool.execute(
    'SELECT name FROM classes WHERE teacher_id = ?',
    [tRows[0].id]
  );
  const classNames = classRows.map((c) => c.name);
  if (tRows[0].form_class && !classNames.includes(tRows[0].form_class)) {
    classNames.push(tRows[0].form_class);
  }
  if (!classNames.length) return res.json([]);

  const ph = classNames.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, name, admission_no, class_name FROM students
     WHERE class_name IN (${ph})
     ORDER BY class_name, name`,
    classNames
  );
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    admissionNo: r.admission_no,
    className: r.class_name,
  })));
});

/* ============================================================
   DELETE a behaviour note (only the author)
   ============================================================ */
router.delete('/:id', allow('teacher'), async (req, res) => {
  const [tRows] = await pool.execute(
    'SELECT id FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!tRows.length) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT id FROM behaviour_reports WHERE id = ? AND teacher_id = ?',
    [req.params.id, tRows[0].id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Report not found' });

  await pool.execute('DELETE FROM behaviour_reports WHERE id = ?', [req.params.id]);
  res.json({ message: 'Note deleted' });
});

module.exports = router;