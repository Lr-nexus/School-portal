const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { notes, noteComments, students, teachers, nextId } = require('../data/db');
const { protect, allow } = require('../middleware/auth');
const { notify, notifyClassStudents } = require('../utils/notify');

router.use(protect);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are allowed'));
  }
});

/* GET /api/notes — role-filtered list */
router.get('/', (req, res) => {
  let list = notes;

  if (req.user.role === 'student') {
    const student = students.find((s) => s.id === req.user.profileId);
    list = notes.filter((n) => n.className === student?.className);
  } else if (req.user.role === 'teacher') {
    list = notes.filter((n) => n.teacherId === req.user.profileId);
  }

  const withCounts = list
    .map((n) => ({
      id: n.id,
      teacherId: n.teacherId,
      teacherName: n.teacherName,
      title: n.title,
      subject: n.subject,
      className: n.className,
      description: n.description,
      type: n.type,
      // Only metadata for lists — the `content` blob is served by GET /:id
      fileName: n.fileName || null,
      originalName: n.originalName || null,
      fileSize: n.fileSize || null,
      fileUrl: n.fileUrl || null,
      uploadedAt: n.uploadedAt,
      commentCount: noteComments.filter((c) => c.noteId === n.id).length
    }))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  res.json(withCounts);
});

/* GET /api/notes/:id — full note + comments */
router.get('/:id', (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) return res.status(404).json({ message: 'Note not found' });

  if (req.user.role === 'student') {
    const student = students.find((s) => s.id === req.user.profileId);
    if (note.className !== student?.className) {
      return res.status(403).json({ message: 'You do not have access to this note' });
    }
  } else if (req.user.role === 'teacher' && note.teacherId !== req.user.profileId) {
    return res.status(403).json({ message: 'You do not have access to this note' });
  }

  const comments = noteComments
    .filter((c) => c.noteId === note.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json({ ...note, comments });
});

/* POST /api/notes — PDF upload (multipart) */
router.post('/', allow('teacher'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const { title, subject, className, description } = req.body;
  if (!title || !className) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Title and class are required' });
  }

  const teacher = teachers.find((t) => t.id === req.user.profileId);
  if (!teacher) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: 'Teacher not found' });
  }

  const note = {
    id: nextId(notes),
    teacherId: teacher.id,
    teacherName: teacher.name,
    title,
    subject: subject || teacher.subjects[0] || 'General',
    className,
    description: description || '',
    type: 'pdf',
    fileName: req.file.filename,
    originalName: req.file.originalname,
    fileSize: req.file.size,
    fileUrl: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString()
  };

  notes.push(note);

  notifyClassStudents(className, {
    type: 'note',
    title: 'New note uploaded',
    body: `${teacher.name} uploaded "${title}"`,
    link: '/student/notes'
  });

  res.status(201).json({ message: 'Note uploaded', note });
});

/* POST /api/notes/rich — rich text note (JSON) */
router.post('/rich', allow('teacher'), (req, res) => {
  const { title, subject, className, description, content } = req.body;

  if (!title || !className) {
    return res.status(400).json({ message: 'Title and class are required' });
  }
  if (!content) {
    return res.status(400).json({ message: 'Note content cannot be empty' });
  }

  // Reject content that is only HTML tags with no real text
  const plainText = String(content).replace(/<[^>]*>/g, '').trim();
  if (!plainText) {
    return res.status(400).json({ message: 'Note content cannot be empty' });
  }

  const teacher = teachers.find((t) => t.id === req.user.profileId);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const note = {
    id: nextId(notes),
    teacherId: teacher.id,
    teacherName: teacher.name,
    title,
    subject: subject || teacher.subjects[0] || 'General',
    className,
    description: description || '',
    type: 'richtext',
    content,
    uploadedAt: new Date().toISOString()
  };

  notes.push(note);

  notifyClassStudents(className, {
    type: 'note',
    title: 'New note posted',
    body: `${teacher.name} posted "${title}"`,
    link: '/student/notes'
  });

  res.status(201).json({ message: 'Note posted', note });
});

/* DELETE /api/notes/:id */
router.delete('/:id', allow('teacher'), (req, res) => {
  const idx = notes.findIndex(
    (n) => n.id === Number(req.params.id) && n.teacherId === req.user.profileId
  );
  if (idx === -1) return res.status(404).json({ message: 'Note not found' });

  const [removed] = notes.splice(idx, 1);

  for (let i = noteComments.length - 1; i >= 0; i--) {
    if (noteComments[i].noteId === removed.id) noteComments.splice(i, 1);
  }

  if (removed.type === 'pdf' && removed.fileName) {
    const fp = path.join(uploadDir, removed.fileName);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  res.json({ message: 'Note deleted' });
});

/* POST /api/notes/:id/comments */
router.post('/:id/comments', (req, res) => {
  const note = notes.find((n) => n.id === Number(req.params.id));
  if (!note) return res.status(404).json({ message: 'Note not found' });

  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });

  const comment = {
    id: nextId(noteComments),
    noteId: note.id,
    userId: req.user.id,
    userName: req.user.name,
    role: req.user.role,
    text,
    date: new Date().toISOString()
  };
  noteComments.push(comment);

  if (note.teacherId) {
    const owner = teachers.find((t) => t.id === note.teacherId);
    if (owner && owner.userId && owner.userId !== req.user.id) {
      notify({
        userId: owner.userId,
        type: 'comment',
        title: 'New comment on your note',
        body: `${req.user.name}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
        link: '/teacher/notes'
      });
    }
  }

  res.status(201).json({ message: 'Comment added', comment });
});

/* DELETE /api/notes/:id/comments/:commentId */
router.delete('/:id/comments/:commentId', (req, res) => {
  const idx = noteComments.findIndex(
    (c) => c.id === Number(req.params.commentId) && c.noteId === Number(req.params.id)
  );
  if (idx === -1) return res.status(404).json({ message: 'Comment not found' });

  if (noteComments[idx].userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You cannot delete this comment' });
  }

  noteComments.splice(idx, 1);
  res.json({ message: 'Comment deleted' });
});

module.exports = router;
module.exports.uploadDir = uploadDir;