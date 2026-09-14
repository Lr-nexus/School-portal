const router = require('express').Router();
const { notifications } = require('../data/db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* GET /api/notifications/me */
router.get('/me', (req, res) => {
  const mine = notifications
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(mine);
});

/* GET /api/notifications/me/unread-count */
router.get('/me/unread-count', (req, res) => {
  const count = notifications.filter((n) => n.userId === req.user.id && !n.read).length;
  res.json({ count });
});

/* PATCH /api/notifications/:id/read */
router.patch('/:id/read', (req, res) => {
  const n = notifications.find(
    (x) => x.id === Number(req.params.id) && x.userId === req.user.id
  );
  if (!n) return res.status(404).json({ message: 'Notification not found' });

  n.read = true;
  res.json({ message: 'Marked read', notification: n });
});

/* PATCH /api/notifications/read-all */
router.patch('/read-all', (req, res) => {
  notifications
    .filter((n) => n.userId === req.user.id)
    .forEach((n) => { n.read = true; });
  res.json({ message: 'All marked read' });
});

/* DELETE /api/notifications/:id */
router.delete('/:id', (req, res) => {
  const idx = notifications.findIndex(
    (n) => n.id === Number(req.params.id) && n.userId === req.user.id
  );
  if (idx === -1) return res.status(404).json({ message: 'Notification not found' });

  notifications.splice(idx, 1);
  res.json({ message: 'Deleted' });
});

module.exports = router;