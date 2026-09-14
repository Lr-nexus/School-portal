const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('teacher'));

// ---------- PROFILE ----------
router.get('/me', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM teachers WHERE user_id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ message: 'Teacher not found' });
  const t = rows[0];
  res.json({
    id: t.id, name: t.name, staffNo: t.staff_no, email: t.email, phone: t.phone,
    subjects: JSON.parse(t.subjects || '[]'), formClass: t.form_class,
    qualification: t.qualification, address: t.address, joined: t.joined,
  });
});

// ---------- UPDATE OWN PROFILE ----------
router.patch('/me', async (req, res) => {
  const [existing] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
  if (!existing.length) return res.status(404).json({ message: 'Teacher not found' });

  const map = { name: 'name', email: 'email', phone: 'phone', formClass: 'form_class', qualification: 'qualification', address: 'address' };
  const updates = [], values = [];
  for (const [key, field] of Object.entries(map)) {
    if (req.body[key] !== undefined) { updates.push(`${field} = ?`); values.push(req.body[key]); }
  }
  if (req.body.subjects !== undefined) {
    const subjects = Array.isArray(req.body.subjects)
      ? req.body.subjects
      : String(req.body.subjects).split(',').map(s => s.trim()).filter(Boolean);
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
      id: t.id, name: t.name, staffNo: t.staff_no, email: t.email, phone: t.phone,
      subjects: JSON.parse(t.subjects || '[]'), formClass: t.form_class,
      qualification: t.qualification, address: t.address, joined: t.joined,
    }
  });
});

// ---------- CLASSES ----------
router.get('/me/classes', async (req, res) => {
  const [teacherRows] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
  if (!teacherRows.length) return res.json([]);

  const [classes] = await pool.execute('SELECT * FROM classes WHERE teacher_id = ?', [teacherRows[0].id]);

  const result = await Promise.all(classes.map(async (c) => {
    const [students] = await pool.execute(
      'SELECT id, name, admission_no, class_name FROM students WHERE class_name = ?',
      [c.name]
    );
    return {
      id: c.id,
      name: c.name,
      subjects: JSON.parse(c.subjects || '[]'),
      students: students.map(s => ({ id: s.id, name: s.name, admissionNo: s.admission_no, className: s.class_name })),
    };
  }));

  res.json(result);
});

// ---------- ANNOUNCEMENTS ----------
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC');
  res.json(rows);
});

module.exports = router;