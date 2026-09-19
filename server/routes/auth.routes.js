const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

/* ==================================================================
   LOGIN
================================================================== */
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

/* ==================================================================
   CURRENT USER
================================================================== */
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

router.patch('/me/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from the current one' });
  }

  const [rows] = await pool.execute(
    'SELECT id, password FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });

  if (rows[0].password !== currentPassword) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  await pool.execute(
    'UPDATE users SET password = ? WHERE id = ?',
    [newPassword, req.user.id]
  );

  res.json({ message: 'Password updated successfully' });
});

module.exports = router;