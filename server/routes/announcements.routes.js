const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { notifyAllUsers } = require('../utils/notify');

router.use(protect);

const CATEGORIES = ['General', 'Urgent', 'Event', 'Holiday', 'Academic'];

/* ---------- LIST ---------- */
router.get('/', async (req, res) => {
  const { category } = req.query;

  let query = 'SELECT * FROM announcements';
  const params = [];

  if (category && category !== 'all') {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY date DESC';

  const [rows] = await pool.execute(query, params);
  res.json(rows);
});

/* ---------- GET ONE ---------- */
router.get('/:id', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Announcement not found' });
  res.json(rows[0]);
});

/* ---------- CREATE (admin only) ---------- */
router.post('/', allow('admin'), async (req, res) => {
  const { title, body, category } = req.body;

  if (!title || !body) {
    return res.status(400).json({ message: 'Title and body are required' });
  }

  const cat = CATEGORIES.includes(category) ? category : 'General';

  const [result] = await pool.execute(
    'INSERT INTO announcements (title, body, date, audience, category) VALUES (?, ?, CURDATE(), ?, ?)',
    [title, body, 'all', cat]
  );

  await notifyAllUsers({
    type: 'announcement',
    title: `New ${cat.toLowerCase()} announcement`,
    body: `${title} — ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}`,
    link: '/home',
  });

  const [rows] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Announcement posted', announcement: rows[0] });
});

/* ---------- UPDATE (admin only) ---------- */
router.patch('/:id', allow('admin'), async (req, res) => {
  const { title, body, category } = req.body;

  const map = {};
  if (title !== undefined) map.title = title;
  if (body !== undefined) map.body = body;
  if (category !== undefined && CATEGORIES.includes(category)) map.category = category;

  const fields = Object.keys(map);
  if (!fields.length) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  const updates = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => map[f]);
  values.push(req.params.id);

  await pool.execute(`UPDATE announcements SET ${updates} WHERE id = ?`, values);

  const [rows] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Announcement not found' });
  res.json({ message: 'Announcement updated', announcement: rows[0] });
});

/* ---------- DELETE (admin only) ---------- */
router.delete('/:id', allow('admin'), async (req, res) => {
  await pool.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ message: 'Announcement deleted' });
});

module.exports = router;