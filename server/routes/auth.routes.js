const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

/* ==================================================================
   Helper — find the display name for a user.
   Prefers the role-specific profile table (which the user can edit),
   falls back to the shared users table.
================================================================== */
async function getDisplayName(userId, role, fallback) {
  try {
    if (role === 'student') {
      const [rows] = await pool.execute(
        'SELECT name FROM students WHERE user_id = ?',
        [userId]
      );
      if (rows.length && rows[0].name) return rows[0].name;
    } else if (role === 'teacher') {
      const [rows] = await pool.execute(
        'SELECT name FROM teachers WHERE user_id = ?',
        [userId]
      );
      if (rows.length && rows[0].name) return rows[0].name;
    } else if (role === 'admin') {
      const [rows] = await pool.execute(
        'SELECT name FROM admins WHERE user_id = ?',
        [userId]
      );
      if (rows.length && rows[0].name) return rows[0].name;
    } else if (req.user.role === 'parent') {
        const [rows] = await pool.execute(
          'SELECT * FROM parents WHERE user_id = ?',
          [req.user.id]
        );
        if (rows.length) {
          const p = rows[0];
          profile = {
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            relationship: p.relationship,
            address: p.address,
            photo: p.photo,
          };
        }
      }
  } catch (err) {
    console.error('getDisplayName failed:', err);
  }
  return fallback;
}

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

  const u = rows[0];

  // ⭐ Prefer the profile table name
  const displayName = await getDisplayName(u.id, u.role, u.name);

  res.json({
    user: {
      id: u.id,
      name: displayName,
      email: u.email,
      role: u.role,
    },
  });
});

/* ==================================================================
   CURRENT USER
================================================================== */
router.get('/me', protect, async (req, res) => {
  let profile = null;

  if (req.user.role === 'student') {
    const [rows] = await pool.execute(
      'SELECT * FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (rows.length) {
      const s = rows[0];
      profile = {
        id: s.id,
        name: s.name,
        admissionNo: s.admission_no,
        className: s.class_name,
        email: s.email,
        gender: s.gender,
        dob: s.dob,
        guardianName: s.guardian_name,
        guardianPhone: s.guardian_phone,
        address: s.address,
        house: s.house,
      };
    }
  } else if (req.user.role === 'teacher') {
    const [rows] = await pool.execute(
      'SELECT * FROM teachers WHERE user_id = ?',
      [req.user.id]
    );
    if (rows.length) {
      const t = rows[0];
      let subjects = [];
      try { subjects = JSON.parse(t.subjects || '[]'); } catch { subjects = []; }
      profile = {
        id: t.id,
        name: t.name,
        staffNo: t.staff_no,
        email: t.email,
        phone: t.phone,
        subjects,
        formClass: t.form_class,
        qualification: t.qualification,
        address: t.address,
        joined: t.joined,
      };
    }
  } else if (req.user.role === 'admin') {
    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE user_id = ?',
      [req.user.id]
    );
    if (rows.length) {
      const a = rows[0];
      profile = {
        id: a.id,
        name: a.name,
        title: a.title,
        email: a.email,
        phone: a.phone,
        office: a.office,
        joined: a.joined,
      };
    }
  }

  // ⭐ Use the profile name if available
  const displayName = profile?.name || req.user.name;

  res.json({
    id: req.user.id,
    name: displayName,
    email: profile?.email || '',
    role: req.user.role,
    profile,
  });
});

/* ==================================================================
   CHANGE PASSWORD
================================================================== */
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