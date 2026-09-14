const { users } = require('../data/db');

function protect(req, res, next) {
  const id = Number(req.headers['x-user-id']);

  if (!id) {
    return res.status(401).json({ message: 'Not authorized, no user id' });
  }

  const user = users.find((u) => u.id === id);
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  req.user = {
    id: user.id,
    role: user.role,
    name: user.name,
    profileId: user.profileId
  };
  next();
}

function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource' });
    }
    next();
  };
}

module.exports = { protect, allow };