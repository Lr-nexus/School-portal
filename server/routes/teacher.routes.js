const router = require('express').Router();
const { teachers, classes, students, announcements } = require('../data/db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('teacher'));

// ---------- PROFILE ----------
router.get('/me', (req, res) => {
  const teacher = teachers.find((t) => t.id === req.user.profileId);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  res.json(teacher);
});

// ---------- UPDATE OWN PROFILE ----------
// PATCH /api/teachers/me
router.patch('/me', (req, res) => {
  const teacher = teachers.find((t) => t.id === req.user.profileId);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const body = { ...req.body };

  // Accept "a, b" or ["a", "b"] for subjects
  if (body.subjects !== undefined) {
    body.subjects = Array.isArray(body.subjects)
      ? body.subjects
      : String(body.subjects)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  }

  const editable = [
    'name', 'email', 'phone', 'subjects',
    'formClass', 'qualification', 'address'
  ];
  editable.forEach((field) => {
    if (body[field] !== undefined) teacher[field] = body[field];
  });

  res.json({ message: 'Profile updated', teacher });
});

// ---------- CLASSES ----------
router.get('/me/classes', (req, res) => {
  const mine = classes.filter((c) => c.teacherId === req.user.profileId);
  const withStudents = mine.map((c) => ({
    ...c,
    students: students
      .filter((s) => c.studentIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, admissionNo: s.admissionNo, className: s.className }))
  }));
  res.json(withStudents);
});

// ---------- ANNOUNCEMENTS ----------
router.get('/me/announcements', (req, res) => res.json(announcements));

module.exports = router;