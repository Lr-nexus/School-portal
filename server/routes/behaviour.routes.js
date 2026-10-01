const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { getTeacherContext } = require('../utils/teacherContext');

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

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

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

  const isFormTeacher = ctx.formClass === student.class_name;
  const isAssigned = ctx.assignments.some((a) => a.className === student.class_name);

  if (!isFormTeacher && !isAssigned) {
    return res.status(403).json({
      message: `You are not assigned to ${student.class_name}. Ask the admin to link you to this class.`,
    });
  }

  const [result] = await pool.execute(
    `INSERT INTO behaviour_reports
       (student_id, teacher_id, type, title, note, date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      studentId, ctx.teacherId, validType, title.trim(),
      String(note || '').trim(),
      date || new Date().toISOString().split('T')[0],
    ]
  );

  /* Notify student + parent */
  try {
    if (student.user_id) {
      await notify({
        userId: student.user_id,
        type: 'behaviour',
        title: validType === 'positive' ? 'New positive note' : 'New behaviour note',
        body: `${ctx.name}: ${title}`,
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
          body: `${ctx.name}: ${title}`,
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
   ============================================================ */
router.get('/mine', allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);

  const [rows] = await pool.execute(
    `SELECT br.*, s.name AS student_name, s.admission_no, s.class_name
     FROM behaviour_reports br
     JOIN students s ON s.id = br.student_id
     WHERE br.teacher_id = ?
     ORDER BY br.date DESC, br.id DESC`,
    [ctx.teacherId]
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
   TEACHER — students the teacher can log notes for
   Includes form class + every class the teacher is assigned to.
   ============================================================ */
router.get('/students', allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);

  const classNames = new Set();
  if (ctx.formClass) classNames.add(ctx.formClass);
  ctx.assignments.forEach((a) => classNames.add(a.className));

  if (!classNames.size) return res.json([]);

  const list = Array.from(classNames);
  const ph = list.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, name, admission_no, class_name FROM students
     WHERE class_name IN (${ph})
     ORDER BY class_name, name`,
    list
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
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT id FROM behaviour_reports WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Report not found' });

  await pool.execute('DELETE FROM behaviour_reports WHERE id = ?', [req.params.id]);
  res.json({ message: 'Note deleted' });
});

module.exports = router;