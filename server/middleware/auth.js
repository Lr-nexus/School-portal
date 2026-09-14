const pool = require('../db');

// Reads the X-User-Id header, looks the user up in MySQL, and attaches
// them to req.user. Works the same as the old in-memory version.
async function protect(req, res, next) {
  const id = Number(req.headers['x-user-id']);

  if (!id) {
    return res.status(401).json({ message: 'Not authorized, no user id' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, role FROM users WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = rows[0];
    req.user = {
      id: user.id,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (err) {
    console.error('auth middleware error:', err);
    res.status(500).json({ message: 'Authentication error' });
  }
}

// Only lets certain roles through
function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource' });
    }
    next();
  };
}

module.exports = { protect, allow };