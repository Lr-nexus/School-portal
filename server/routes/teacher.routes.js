const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getTeacherContext, teachablePairs } = require('../utils/teacherContext');

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

/* ---------- ANNOUNCEMENTS ---------- */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM announcements ORDER BY date DESC LIMIT 10'
  );
  res.json(rows);
});

module.exports = router;