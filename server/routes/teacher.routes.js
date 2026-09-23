const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('teacher'));

/* ---------- safe JSON parse ---------- */
function parseSubjects(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

/* ==================================================================
   PROFILE
================================================================== */
router.get('/me', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Teacher not found' });
  const t = rows[0];
  res.json({
    id: t.id,
    name: t.name,
    staffNo: t.staff_no,
    email: t.email,
    phone: t.phone || '',
    subjects: parseSubjects(t.subjects),
    formClass: t.form_class || '',
    qualification: t.qualification || '',
    address: t.address || '',
    joined: t.joined,
  });
});

/* ==================================================================
   UPDATE OWN PROFILE
================================================================== */
router.patch('/me', async (req, res) => {
  const [existing] = await pool.execute(
    'SELECT id FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!existing.length) return res.status(404).json({ message: 'Teacher not found' });

  const map = {
    name: 'name', email: 'email', phone: 'phone',
    formClass: 'form_class', qualification: 'qualification', address: 'address'
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
    values.push(req.user.id);
    await pool.execute(`UPDATE teachers SET ${updates.join(', ')} WHERE user_id = ?`, values);
  }

  const [rows] = await pool.execute('SELECT * FROM teachers WHERE user_id = ?', [req.user.id]);
  const t = rows[0];
  res.json({
    message: 'Profile updated',
    teacher: {
      id: t.id,
      name: t.name,
      staffNo: t.staff_no,
      email: t.email,
      phone: t.phone || '',
      subjects: parseSubjects(t.subjects),
      formClass: t.form_class || '',
      qualification: t.qualification || '',
      address: t.address || '',
      joined: t.joined,
    }
  });
});

/* ==================================================================
   MY CLASSES — with subject fallback
================================================================== */
router.get('/me/classes', async (req, res) => {
  const [teacherRows] = await pool.execute(
    'SELECT id, form_class, subjects FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!teacherRows.length) return res.json([]);
  const teacherId = teacherRows[0].id;
  const teacherSubjects = parseSubjects(teacherRows[0].subjects);

  const [classes] = await pool.execute(
    'SELECT * FROM classes WHERE teacher_id = ? ORDER BY name',
    [teacherId]
  );

  const result = await Promise.all(classes.map(async (c) => {
    const [students] = await pool.execute(
      'SELECT id, name, admission_no, class_name FROM students WHERE class_name = ? ORDER BY name',
      [c.name]
    );

    const classSubjects = parseSubjects(c.subjects);
    const subjects = classSubjects.length > 0 ? classSubjects : teacherSubjects;

    return {
      id: c.id,
      name: c.name,
      subjects,
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        admissionNo: s.admission_no,
        className: s.class_name,
      })),
    };
  }));

  res.json(result);
});

/* ==================================================================
   MY STUDENTS — flat list of every student in the teacher's form classes
================================================================== */
router.get('/me/students', async (req, res) => {
  const [teacherRows] = await pool.execute(
    'SELECT id, form_class FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!teacherRows.length) {
    return res.json({ formClass: null, classNames: [], students: [] });
  }

  const teacher = teacherRows[0];

  const [classRows] = await pool.execute(
    'SELECT name FROM classes WHERE teacher_id = ? ORDER BY name',
    [teacher.id]
  );

  const classNames = classRows.map((c) => c.name);
  if (teacher.form_class && !classNames.includes(teacher.form_class)) {
    classNames.push(teacher.form_class);
  }

  if (!classNames.length) {
    return res.json({ formClass: teacher.form_class || null, classNames: [], students: [] });
  }

  const placeholders = classNames.map(() => '?').join(',');
  const [students] = await pool.execute(
    `SELECT id, name, admission_no, class_name, gender, email, guardian_name, guardian_phone
     FROM students
     WHERE class_name IN (${placeholders})
     ORDER BY class_name, name`,
    classNames
  );

  res.json({
    formClass: teacher.form_class || null,
    classNames,
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNo: s.admission_no,
      className: s.class_name,
      gender: s.gender || '',
      email: s.email || '',
      guardianName: s.guardian_name || '',
      guardianPhone: s.guardian_phone || '',
    })),
  });
});

/* ==================================================================
   ANNOUNCEMENTS
================================================================== */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM announcements ORDER BY date DESC LIMIT 10'
  );
  res.json(rows);
});

module.exports = router;