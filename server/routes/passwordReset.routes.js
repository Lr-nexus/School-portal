const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db');
const { sendEmail, passwordResetEmail } = require('../utils/email');

/* ============================================================
   POST /api/password-reset/forgot
   body: { email }
   ============================================================ */
router.post('/forgot', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const [users] = await pool.execute(
    'SELECT id, name, email FROM users WHERE email = ?',
    [email]
  );

  // Always return the same message, even if the email doesn't exist
  // (so attackers can't enumerate accounts)
  const genericMessage = 'If an account exists with that email, a reset link has been sent.';

  if (!users.length) {
    return res.json({ message: genericMessage });
  }

  const user = users[0];

  // Invalidate old tokens
  await pool.execute(
    'UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0',
    [user.id]
  );

  // Create token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.execute(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, token, expiresAt]
  );

  // Build the reset link — frontend URL, not API URL
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password/${token}`;

  // Send email (falls back to console log if no Resend key)
  const tpl = passwordResetEmail({ name: user.name, resetUrl, expiryMinutes: 60 });
  await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html });

  res.json({ message: genericMessage });
});

/* ============================================================
   GET /api/password-reset/verify/:token
   ============================================================ */
router.get('/verify/:token', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT pr.*, u.email, u.name
     FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.token = ? AND pr.used = 0 AND pr.expires_at > NOW()`,
    [req.params.token]
  );

  if (!rows.length) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired' });
  }

  res.json({
    valid: true,
    email: rows[0].email,
    name: rows[0].name,
    expiresAt: rows[0].expires_at,
  });
});

/* ============================================================
   POST /api/password-reset/reset
   body: { token, newPassword }
   ============================================================ */
router.post('/reset', async (req, res) => {
  const token = String(req.body.token || '').trim();
  const newPassword = String(req.body.newPassword || '');

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  const [rows] = await pool.execute(
    `SELECT * FROM password_resets
     WHERE token = ? AND used = 0 AND expires_at > NOW()`,
    [token]
  );

  if (!rows.length) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired' });
  }

  const reset = rows[0];

  await pool.execute('UPDATE users SET password = ? WHERE id = ?', [
    newPassword,
    reset.user_id,
  ]);

  await pool.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

  res.json({ message: 'Password updated. You can now log in.' });
});

module.exports = router;