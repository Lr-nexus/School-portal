const router = require('express').Router();
const multer = require('multer');
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { notify, notifyClassStudents } = require('../utils/notify');
const { uploadFile, deleteFile } = require('../utils/cloudStorage');
const { getTeacherContext, canTeach } = require('../utils/teacherContext');

router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are allowed'));
  },
});

/* ---------- LIST ---------- */
router.get('/', async (req, res) => {
  let query = `
    SELECT n.*, t.name AS teacher_name,
      (SELECT COUNT(*) FROM note_comments c WHERE c.note_id = n.id) AS comment_count
    FROM notes n
    LEFT JOIN teachers t ON t.id = n.teacher_id
  `;
  const params = [];

  if (req.user.role === 'student') {
    const [rows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?', [req.user.id]
    );
    if (!rows.length) return res.json([]);
    query += ' WHERE n.class_name = ?';
    params.push(rows[0].class_name);
  } else if (req.user.role === 'teacher') {
    const ctx = await getTeacherContext(req.user.id);
    if (!ctx) return res.json([]);
    query += ' WHERE n.teacher_id = ?';
    params.push(ctx.teacherId);
  }

  query += ' ORDER BY n.uploaded_at DESC';
  const [notes] = await pool.execute(query, params);

  res.json(notes.map((n) => ({
    id: n.id, teacherId: n.teacher_id, teacherName: n.teacher_name || 'Teacher',
    title: n.title, subject: n.subject, className: n.class_name,
    description: n.description, type: n.type,
    fileName: n.file_name, originalName: n.original_name, fileSize: n.file_size,
    fileUrl: n.file_url, uploadedAt: n.uploaded_at, commentCount: n.comment_count,
  })));
});

/* ---------- GET ONE ---------- */
router.get('/:id', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT n.*, t.name AS teacher_name FROM notes n
     LEFT JOIN teachers t ON t.id = n.teacher_id
     WHERE n.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Note not found' });
  const note = rows[0];

  if (req.user.role === 'student') {
    const [sRows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?', [req.user.id]
    );
    if (!sRows.length || sRows[0].class_name !== note.class_name) {
      return res.status(403).json({ message: 'You do not have access to this note' });
    }
  } else if (req.user.role === 'teacher') {
    const ctx = await getTeacherContext(req.user.id);
    if (!ctx || ctx.teacherId !== note.teacher_id) {
      return res.status(403).json({ message: 'You do not have access to this note' });
    }
  }

  const [comments] = await pool.execute(
    'SELECT * FROM note_comments WHERE note_id = ? ORDER BY date ASC', [note.id]
  );

  res.json({
    id: note.id, teacherId: note.teacher_id, teacherName: note.teacher_name,
    title: note.title, subject: note.subject, className: note.class_name,
    description: note.description, type: note.type,
    fileName: note.file_name, originalName: note.original_name,
    fileSize: note.file_size, fileUrl: note.file_url, content: note.content,
    uploadedAt: note.uploaded_at,
    comments: comments.map((c) => ({
      id: c.id, userId: c.user_id, userName: c.user_name,
      role: c.role, text: c.text, date: c.date,
    })),
  });
});

/* ---------- POST — PDF upload (validated) ---------- */
router.post('/', allow('teacher'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const { title, subject, className, description } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  if (!className) return res.status(400).json({ message: 'className is required' });
  if (!subject) return res.status(400).json({ message: 'subject is required' });

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({
      message: `You are not assigned to teach ${subject} in ${className}`,
    });
  }

  try {
    const up = await uploadFile(req.file.buffer, req.file.originalname, 'notes');

    const [result] = await pool.execute(
      `INSERT INTO notes (teacher_id, title, subject, class_name, description, type, file_name, original_name, file_size, file_url, uploaded_at)
       VALUES (?, ?, ?, ?, ?, 'pdf', ?, ?, ?, ?, NOW())`,
      [
        ctx.teacherId, title, subject, className, description || '',
        up.publicId || up.url, req.file.originalname, req.file.size, up.url,
      ]
    );

    await notifyClassStudents(className, {
      type: 'note', title: 'New note uploaded',
      body: `${ctx.name} uploaded "${title}"`,
      link: '/student/notes',
    });

    const [rows] = await pool.execute('SELECT * FROM notes WHERE id = ?', [result.insertId]);
    res.status(201).json({ message: 'Note uploaded', note: rows[0] });
  } catch (err) {
    console.error('Note upload failed:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

/* ---------- POST — rich text ---------- */
router.post('/rich', allow('teacher'), async (req, res) => {
  const { title, subject, className, description, content } = req.body;

  if (!title) return res.status(400).json({ message: 'Title is required' });
  if (!className) return res.status(400).json({ message: 'className is required' });
  if (!subject) return res.status(400).json({ message: 'subject is required' });
  if (!content) return res.status(400).json({ message: 'Note content cannot be empty' });

  const plain = String(content).replace(/<[^>]*>/g, '').trim();
  if (!plain) return res.status(400).json({ message: 'Note content cannot be empty' });

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({
      message: `You are not assigned to teach ${subject} in ${className}`,
    });
  }

  const [result] = await pool.execute(
    `INSERT INTO notes (teacher_id, title, subject, class_name, description, type, content, uploaded_at)
     VALUES (?, ?, ?, ?, ?, 'richtext', ?, NOW())`,
    [ctx.teacherId, title, subject, className, description || '', content]
  );

  await notifyClassStudents(className, {
    type: 'note', title: 'New note posted',
    body: `${ctx.name} posted "${title}"`,
    link: '/student/notes',
  });

  const [rows] = await pool.execute('SELECT * FROM notes WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Note posted', note: rows[0] });
});

/* ---------- DELETE ---------- */
router.delete('/:id', allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM notes WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Note not found' });
  const note = rows[0];

  if (note.file_name) await deleteFile(note.file_name);

  await pool.execute('DELETE FROM notes WHERE id = ?', [note.id]);
  res.json({ message: 'Note deleted' });
});

/* ---------- COMMENTS ---------- */
router.post('/:id/comments', async (req, res) => {
  const [noteRows] = await pool.execute('SELECT * FROM notes WHERE id = ?', [req.params.id]);
  if (!noteRows.length) return res.status(404).json({ message: 'Note not found' });
  const note = noteRows[0];

  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });

  const [result] = await pool.execute(
    'INSERT INTO note_comments (note_id, user_id, user_name, role, text, date) VALUES (?, ?, ?, ?, ?, NOW())',
    [note.id, req.user.id, req.user.name, req.user.role, text]
  );

  if (note.teacher_id) {
    const [tRows] = await pool.execute(
      'SELECT user_id FROM teachers WHERE id = ?', [note.teacher_id]
    );
    if (tRows.length && tRows[0].user_id && tRows[0].user_id !== req.user.id) {
      await notify({
        userId: tRows[0].user_id, type: 'comment',
        title: 'New comment on your note',
        body: `${req.user.name}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
        link: '/teacher/notes',
      });
    }
  }

  const [rows] = await pool.execute('SELECT * FROM note_comments WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Comment added', comment: rows[0] });
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM note_comments WHERE id = ? AND note_id = ?',
    [req.params.commentId, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Comment not found' });

  if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You cannot delete this comment' });
  }

  await pool.execute('DELETE FROM note_comments WHERE id = ?', [rows[0].id]);
  res.json({ message: 'Comment deleted' });
});

module.exports = router;