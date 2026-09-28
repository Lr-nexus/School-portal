const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getTeacherContext, teachablePairs, canTeach } = require('../utils/teacherContext');

router.use(protect, allow('teacher'));

function parseSubjects(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }
}

/* ---------- PROFILE ---------- */
router.get('/me', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute('SELECT * FROM teachers WHERE id = ?', [ctx.teacherId]);
  const t = rows[0];

  res.json({
    id: t.id,
    name: t.name,
    staffNo: t.staff_no,
    email: t.email,
    phone: t.phone || '',
    subjects: parseSubjects(t.subjects),
    formClass: t.form_class || '',
    teacherType: t.teacher_type || 'class_teacher',
    assignments: ctx.assignments,
    qualification: t.qualification || '',
    address: t.address || '',
    joined: t.joined,
    photo: t.photo || null,
  });
});

/* ---------- UPDATE OWN PROFILE ---------- */
router.patch('/me', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const map = {
    name: 'name', email: 'email', phone: 'phone',
    formClass: 'form_class', qualification: 'qualification', address: 'address',
  };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (req.body.subjects !== undefined) {
    const subjects = Array.isArray(req.body.subjects)
      ? req.body.subjects
      : String(req.body.subjects).split(',').map((s) => s.trim()).filter(Boolean);
    updates.push('subjects = ?');
    values.push(JSON.stringify(subjects));
  }
  if (updates.length) {
    values.push(ctx.teacherId);
    await pool.execute(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  const userUpdates = [], userValues = [];
  if (req.body.name !== undefined)  { userUpdates.push('name = ?');  userValues.push(req.body.name); }
  if (req.body.email !== undefined) { userUpdates.push('email = ?'); userValues.push(String(req.body.email).toLowerCase()); }
  if (userUpdates.length) {
    userValues.push(req.user.id);
    await pool.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
  }

  const [rows] = await pool.execute('SELECT * FROM teachers WHERE id = ?', [ctx.teacherId]);
  const t = rows[0];
  res.json({
    message: 'Profile updated',
    teacher: {
      id: t.id, name: t.name, staffNo: t.staff_no, email: t.email,
      phone: t.phone || '', subjects: parseSubjects(t.subjects),
      formClass: t.form_class || '', teacherType: t.teacher_type,
      qualification: t.qualification || '', address: t.address || '',
      joined: t.joined, photo: t.photo || null,
    },
  });
});

/* ---------- MY TEACHING TARGETS (className, subject) ---------- */
router.get('/me/assignments', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);
  res.json(teachablePairs(ctx));
});

/* ---------- MY CLASSES ---------- */
router.get('/me/classes', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);

  const classNames = new Set();
  if (ctx.formClass) classNames.add(ctx.formClass);
  ctx.assignments.forEach((a) => classNames.add(a.className));

  if (!classNames.size) return res.json([]);

  const result = [];
  for (const cName of classNames) {
    const [clsRows] = await pool.execute('SELECT * FROM classes WHERE name = ?', [cName]);
    const [students] = await pool.execute(
      'SELECT id, name, admission_no, class_name FROM students WHERE class_name = ? ORDER BY name',
      [cName]
    );

    const classSubjects = ctx.assignments
      .filter((a) => a.className === cName)
      .map((a) => a.subject);

    result.push({
      id: clsRows[0]?.id,
      name: cName,
      subjects: classSubjects.length ? classSubjects : ctx.subjects,
      isFormClass: cName === ctx.formClass,
      students: students.map((s) => ({
        id: s.id, name: s.name, admissionNo: s.admission_no, className: s.class_name,
      })),
    });
  }

  res.json(result);
});

/* ---------- MY STUDENTS ---------- */
router.get('/me/students', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json({ formClass: null, classNames: [], students: [] });

  const classNames = new Set();
  if (ctx.formClass) classNames.add(ctx.formClass);
  ctx.assignments.forEach((a) => classNames.add(a.className));

  if (!classNames.size) {
    return res.json({
      formClass: null, teacherType: ctx.teacherType, classNames: [], students: [],
    });
  }

  const list = Array.from(classNames);
  const placeholders = list.map(() => '?').join(',');
  const [students] = await pool.execute(
    `SELECT id, name, admission_no, class_name, gender, email, guardian_name, guardian_phone
     FROM students WHERE class_name IN (${placeholders})
     ORDER BY class_name, name`,
    list
  );

  res.json({
    formClass: ctx.formClass || null,
    teacherType: ctx.teacherType,
    classNames: list,
    students: students.map((s) => ({
      id: s.id, name: s.name, admissionNo: s.admission_no,
      className: s.class_name, gender: s.gender || '',
      email: s.email || '', guardianName: s.guardian_name || '',
      guardianPhone: s.guardian_phone || '',
    })),
  });
});

function pctToGrade(pct) {
  if (pct >= 75) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 45) return 'D';
  if (pct >= 40) return 'E';
  return 'F';
}

/* ==========================================================================
   GRADEBOOK
   ========================================================================== */

/* GET /me/academic/gradebook — fetch all students + their CA/exam for a slot */
router.get('/me/academic/gradebook', async (req, res) => {
  const { className, subject, session, term } = req.query;
  if (!className || !subject || !session || !term) {
    return res.status(400).json({ message: 'className, subject, session and term are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [rows] = await pool.execute(
    `SELECT s.id, s.name, s.admission_no, r.ca, r.exam
     FROM students s
     LEFT JOIN results r
       ON r.student_id = s.id
      AND r.session = ?
      AND r.term = ?
      AND r.subject = ?
     WHERE s.class_name = ?
     ORDER BY s.name`,
    [session, term, subject, className]
  );

  res.json(rows.map((row) => ({
    studentId: row.id,
    name: row.name,
    admissionNo: row.admission_no,
    ca: row.ca,
    exam: row.exam,
  })));
});

/* PUT /me/academic/gradebook — save a batch of CA/exam entries */
router.put('/me/academic/gradebook', async (req, res) => {
  const { className, subject, session, term, entries } = req.body;

  if (!className || !subject || !session || !term || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({
      message: 'className, subject, session, term and entries are required',
    });
  }

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  /* Validate IDs */
  const studentIds = entries.map((entry) => Number(entry.studentId));
  if (
    studentIds.some((id) => !Number.isInteger(id) || id < 1) ||
    new Set(studentIds).size !== studentIds.length
  ) {
    return res.status(400).json({ message: 'Entries must contain unique valid student IDs' });
  }

  /* Validate scores */
  for (const entry of entries) {
    const ca = Number(entry.ca);
    const exam = Number(entry.exam);
    if (!Number.isInteger(ca) || ca < 0 || ca > 30 || !Number.isInteger(exam) || exam < 0 || exam > 70) {
      return res.status(400).json({ message: 'CA must be 0–30 and exam must be 0–70' });
    }
  }

  /* Confirm all students are actually in this class */
  const placeholders = studentIds.map(() => '?').join(',');
  const [roster] = await pool.execute(
    `SELECT id FROM students WHERE class_name = ? AND id IN (${placeholders})`,
    [className, ...studentIds]
  );
  if (roster.length !== studentIds.length) {
    return res.status(400).json({ message: 'One or more students are not in this class' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const entry of entries) {
      await conn.execute(
        `INSERT INTO results (student_id, session, term, subject, ca, exam)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ca = VALUES(ca), exam = VALUES(exam)`,
        [Number(entry.studentId), session, term, subject, Number(entry.ca), Number(entry.exam)]
      );
    }
    await conn.commit();
    res.json({ message: `Saved grades for ${entries.length} student(s)`, saved: entries.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message || 'Failed to save grades' });
  } finally {
    conn.release();
  }
});

/* ==========================================================================
   PROGRESS — average across terms for a class+subject
   ========================================================================== */
router.get('/me/academic/progress', async (req, res) => {
  const { className, subject } = req.query;
  if (!className || !subject) {
    return res.status(400).json({ message: 'className and subject are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [rows] = await pool.execute(
    `SELECT r.session, r.term,
            ROUND(AVG(COALESCE(r.ca, 0) + COALESCE(r.exam, 0))) AS average,
            COUNT(DISTINCT r.student_id) AS student_count
     FROM results r
     INNER JOIN students s ON s.id = r.student_id
     WHERE s.class_name = ? AND r.subject = ?
     GROUP BY r.session, r.term
     ORDER BY r.session ASC,
       FIELD(r.term, 'First Term', 'Second Term', 'Third Term'), r.term ASC`,
    [className, subject]
  );

  res.json(rows.map((row) => ({
    session: row.session,
    term: row.term,
    average: Number(row.average || 0),
    studentCount: Number(row.student_count || 0),
  })));
});

/* ==========================================================================
   QUESTION BANK
   ========================================================================== */

/* GET /me/academic/questions — list all questions for class+subject */
router.get('/me/academic/questions', async (req, res) => {
  const { className, subject } = req.query;
  if (!className || !subject) {
    return res.status(400).json({ message: 'className and subject are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [rows] = await pool.execute(
    `SELECT id, question, options, answer, created_at
     FROM question_bank
     WHERE teacher_id = ? AND class_name = ? AND subject = ?
     ORDER BY created_at DESC, id DESC`,
    [ctx.teacherId, className, subject]
  );
  res.json(rows.map((row) => ({
    ...row,
    options: JSON.parse(row.options || '[]'),
  })));
});

/* POST /me/academic/questions — add a question */
router.post('/me/academic/questions', async (req, res) => {
  const { className, subject, question, options, answer } = req.body;

  if (
    !className || !subject || !String(question || '').trim() ||
    !Array.isArray(options) || options.length < 2 || options.length > 4
  ) {
    return res.status(400).json({
      message: 'Class, subject, question and 2–4 options are required',
    });
  }

  const normalizedOptions = options.map((option) => String(option || '').trim());
  const answerIndex = Number(answer);

  if (
    normalizedOptions.some((option) => !option) ||
    !Number.isInteger(answerIndex) ||
    answerIndex < 0 ||
    answerIndex >= options.length
  ) {
    return res.status(400).json({
      message: 'Enter each option and select a valid correct answer',
    });
  }

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [result] = await pool.execute(
    `INSERT INTO question_bank (teacher_id, class_name, subject, question, options, answer)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      ctx.teacherId, className, subject,
      String(question).trim(),
      JSON.stringify(normalizedOptions),
      answerIndex,
    ]
  );

  res.status(201).json({
    id: result.insertId,
    question: String(question).trim(),
    options: normalizedOptions,
    answer: answerIndex,
  });
});

/* DELETE /me/academic/questions/:id — remove a question */
router.delete('/me/academic/questions/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    'DELETE FROM question_bank WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Question not found' });
  }
  res.json({ message: 'Question removed from the bank' });
});

/* ==========================================================================
   LESSON PLANS
   ========================================================================== */

/* GET /me/academic/lessons — all lesson plans for this teacher */
router.get('/me/academic/lessons', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    `SELECT id, class_name, subject, title,
            DATE_FORMAT(lesson_date, '%Y-%m-%d') AS lesson_date,
            objectives, activities, resources, created_at
     FROM lesson_plans
     WHERE teacher_id = ?
     ORDER BY lesson_date DESC, id DESC`,
    [ctx.teacherId]
  );
  res.json(rows);
});

/* POST /me/academic/lessons — create a lesson plan */
router.post('/me/academic/lessons', async (req, res) => {
  const { className, subject, title, lessonDate, objectives, activities, resources } = req.body;

  if (
    !className || !subject || !String(title || '').trim() ||
    !lessonDate || !String(objectives || '').trim()
  ) {
    return res.status(400).json({
      message: 'Class, subject, title, date and objectives are required',
    });
  }

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [result] = await pool.execute(
    `INSERT INTO lesson_plans
       (teacher_id, class_name, subject, title, lesson_date, objectives, activities, resources)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.teacherId, className, subject,
      String(title).trim(), lessonDate,
      String(objectives).trim(),
      activities || '', resources || '',
    ]
  );
  res.status(201).json({ id: result.insertId, message: 'Lesson plan saved' });
});

/* DELETE /me/academic/lessons/:id — remove a lesson plan */
router.delete('/me/academic/lessons/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    'DELETE FROM lesson_plans WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Lesson plan not found' });
  }
  res.json({ message: 'Lesson plan deleted' });
});

/* ---------- ANNOUNCEMENTS ---------- */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM announcements ORDER BY date DESC LIMIT 10'
  );
  res.json(rows);
});

module.exports = router;