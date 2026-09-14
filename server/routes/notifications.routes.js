const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/me', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows.map(n => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    link: n.link, read: !!n.read, createdAt: n.created_at,
  })));
});

router.get('/me/unread-count', async (req, res) => {
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND `read` = 0',
    [req.user.id]
  );
  res.json({ count });
});

router.patch('/:id/read', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Notification not found' });
  await pool.execute('UPDATE notifications SET `read` = 1 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Marked read' });
});

router.patch('/read-all', async (req, res) => {
  await pool.execute('UPDATE notifications SET `read` = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All marked read' });
});

router.delete('/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Notification not found' });
  await pool.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;