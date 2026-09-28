const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* ============================================================
   LIST & FILTER — every logged-in user can browse the library
   ============================================================ */
router.get('/', async (req, res) => {
  const { q, type, subject, className } = req.query;
  const where = [];
  const values = [];

  if (q) {
    where.push('(title LIKE ? OR author LIKE ? OR description LIKE ?)');
    const like = `%${q}%`;
    values.push(like, like, like);
  }
  if (type && type !== 'all') {
    where.push('type = ?');
    values.push(type);
  }
  if (subject && subject !== 'all') {
    where.push('subject = ?');
    values.push(subject);
  }
  // Students only see resources for their class or with no class filter
  if (req.user.role === 'student') {
    const [s] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (s.length) {
      where.push('(class_name IS NULL OR class_name = ? OR class_name = "")');
      values.push(s[0].class_name);
    }
  } else if (className && className !== 'all') {
    where.push('class_name = ?');
    values.push(className);
  }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM library_resources ${whereSQL}
       ORDER BY created_at DESC, id DESC`,
      values
    );

    // Attach my bookmark status for each resource
    const [marks] = await pool.execute(
      'SELECT resource_id, list, progress, notes FROM library_bookmarks WHERE user_id = ?',
      [req.user.id]
    );
    const byId = Object.fromEntries(marks.map((m) => [m.resource_id, m]));

    res.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      subject: r.subject,
      className: r.class_name,
      author: r.author,
      description: r.description,
      url: r.url,
      coverUrl: r.cover_url,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
      bookmarked: byId[r.id] ? byId[r.id].list : null,
      progress: byId[r.id]?.progress ?? 0,
      personalNotes: byId[r.id]?.notes ?? '',
    })));
  } catch (err) {
    console.error('Library list failed:', err);
    res.status(500).json({ message: err.message });
  }
});

/* Filter facets for the UI */
router.get('/facets', async (req, res) => {
  try {
    const [subjects] = await pool.execute(
      `SELECT DISTINCT subject FROM library_resources
       WHERE subject IS NOT NULL AND subject != ''
       ORDER BY subject`
    );
    const [classes] = await pool.execute(
      `SELECT DISTINCT class_name FROM library_resources
       WHERE class_name IS NOT NULL AND class_name != ''
       ORDER BY class_name`
    );
    res.json({
      subjects: subjects.map((s) => s.subject),
      classes: classes.map((c) => c.class_name),
      types: ['book', 'pdf', 'article', 'video', 'link', 'past_question'],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* My reading list — resources I've bookmarked */
router.get('/me/reading-list', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, b.list, b.progress, b.notes, b.added_at, b.updated_at
       FROM library_bookmarks b
       JOIN library_resources r ON r.id = b.resource_id
       WHERE b.user_id = ?
       ORDER BY b.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      subject: r.subject,
      className: r.class_name,
      author: r.author,
      description: r.description,
      url: r.url,
      coverUrl: r.cover_url,
      list: r.list,
      progress: r.progress,
      personalNotes: r.notes,
      addedAt: r.added_at,
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   ADMIN / TEACHER — manage resources
   ============================================================ */
router.post('/', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admins and teachers can add resources' });
  }

  const {
    title, type = 'book', subject, className, author,
    description, url, coverUrl,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO library_resources
        (title, type, subject, class_name, author, description, url, cover_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(title).trim(),
        type || 'book',
        subject || null,
        className || null,
        author || null,
        description || '',
        url || null,
        coverUrl || null,
        req.user.id,
      ]
    );
    const [rows] = await pool.execute(
      'SELECT * FROM library_resources WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ message: 'Resource added', resource: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }
  const [own] = await pool.execute(
    'SELECT uploaded_by FROM library_resources WHERE id = ?',
    [req.params.id]
  );
  if (!own.length) return res.status(404).json({ message: 'Resource not found' });
  if (req.user.role !== 'admin' && own[0].uploaded_by !== req.user.id) {
    return res.status(403).json({ message: 'You can only edit your own resources' });
  }

  const fields = ['title', 'type', 'subject', 'className', 'author', 'description', 'url', 'coverUrl'];
  const cols = ['title', 'type', 'subject', 'class_name', 'author', 'description', 'url', 'cover_url'];
  const updates = [], values = [];
  for (let i = 0; i < fields.length; i++) {
    if (req.body[fields[i]] !== undefined) {
      updates.push(`${cols[i]} = ?`);
      values.push(req.body[fields[i]]);
    }
  }
  if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });
  values.push(req.params.id);
  await pool.execute(
    `UPDATE library_resources SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  const [rows] = await pool.execute(
    'SELECT * FROM library_resources WHERE id = ?',
    [req.params.id]
  );
  res.json({ message: 'Resource updated', resource: rows[0] });
});

router.delete('/:id', async (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }
  const [own] = await pool.execute(
    'SELECT uploaded_by FROM library_resources WHERE id = ?',
    [req.params.id]
  );
  if (!own.length) return res.status(404).json({ message: 'Resource not found' });
  if (req.user.role !== 'admin' && own[0].uploaded_by !== req.user.id) {
    return res.status(403).json({ message: 'You can only delete your own resources' });
  }
  await pool.execute('DELETE FROM library_resources WHERE id = ?', [req.params.id]);
  res.json({ message: 'Resource deleted' });
});

/* ============================================================
   EVERY USER — bookmark management
   ============================================================ */
router.post('/:id/bookmark', async (req, res) => {
  const { list = 'reading', progress = 0, notes = '' } = req.body;
  try {
    const [resource] = await pool.execute(
      'SELECT id FROM library_resources WHERE id = ?',
      [req.params.id]
    );
    if (!resource.length) return res.status(404).json({ message: 'Resource not found' });

    await pool.execute(
      `INSERT INTO library_bookmarks (user_id, resource_id, list, progress, notes)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         list = VALUES(list),
         progress = VALUES(progress),
         notes = VALUES(notes)`,
      [req.user.id, req.params.id, list, progress, notes]
    );
    res.json({ message: 'Added to your list' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/bookmark', async (req, res) => {
  const { list, progress, notes } = req.body;
  const updates = [];
  const values = [];
  if (list !== undefined) { updates.push('list = ?'); values.push(list); }
  if (progress !== undefined) { updates.push('progress = ?'); values.push(Number(progress)); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(String(notes)); }
  if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });

  values.push(req.user.id, req.params.id);
  const [result] = await pool.execute(
    `UPDATE library_bookmarks SET ${updates.join(', ')}
     WHERE user_id = ? AND resource_id = ?`,
    values
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Not in your list' });
  res.json({ message: 'Updated' });
});

router.delete('/:id/bookmark', async (req, res) => {
  await pool.execute(
    'DELETE FROM library_bookmarks WHERE user_id = ? AND resource_id = ?',
    [req.user.id, req.params.id]
  );
  res.json({ message: 'Removed from your list' });
});

module.exports = router;