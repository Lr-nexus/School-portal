const router = require('express').Router();
const { users, students, teachers, admins } = require('../data/db');
const { protect } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // No token — just the user object
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileId: user.profileId
    }
  });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  let profile = null;
  if (req.user.role === 'student') profile = students.find((s) => s.id === req.user.profileId);
  if (req.user.role === 'teacher') profile = teachers.find((t) => t.id === req.user.profileId);
  if (req.user.role === 'admin')   profile = admins.find((a) => a.id === req.user.profileId);

  res.json({ ...req.user, profile });
});

module.exports = router;