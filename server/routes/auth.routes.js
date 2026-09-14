const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const [rows] = await pool.execute(
    'SELECT id, name, email, role FROM users WHERE email = ? AND password = ?',
    [email, password]
  );

  if (!rows.length) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const user = rows[0];
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  let profile = null;
  const { id, role } = req.user;

  if (role === 'student') {
    const [rows] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [id]);
    if (rows.length) profile = rows[0];
  } else if (role === 'teacher') {
    const [rows] = await pool.execute('SELECT * FROM teachers WHERE user_id = ?', [id]);
    if (rows.length) {
      profile = rows[0];
      profile.subjects = JSON.parse(profile.subjects || '[]');
    }
  } else if (role === 'admin') {
    const [rows] = await pool.execute('SELECT * FROM admins WHERE user_id = ?', [id]);
    if (rows.length) profile = rows[0];
  }

  res.json({ ...req.user, profile });
});

module.exports = router;