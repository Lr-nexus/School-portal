const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  assignments, assignmentSubmissions, students, teachers,
  classes, nextId
} = require('../data/db');
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

// Accept PDF, DOC, DOCX, images, ZIP — up to 20MB
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'application/zip'
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type'));
  }
});

/* GET /api/assignments */
router.get('/', (req, res) => {
  let list = assignments;

  if (req.user.role === 'student') {
    const student = students.find((s) => s.id === req.user.profileId);
    list = assignments.filter((a) => a.className === student?.className);
  } else if (req.user.role === 'teacher') {
    list = assignments.filter((a) => a.teacherId === req.user.profileId);
  }

  const enriched = list
    .map((a) => {
      const subs = assignmentSubmissions.filter((s) => s.assignmentId === a.id);
      const mySub = req.user.role === 'student'
        ? subs.find((s) => s.studentId === req.user.profileId)
        : null;
      return {
        ...a,
        submissionCount: subs.length,
        mySubmission: mySub || null
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(enriched);
});

/* GET /api/assignments/:id */
router.get('/:id', (req, res) => {
  const a = assignments.find((x) => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ message: 'Assignment not found' });

  if (req.user.role === 'student') {
    const student = students.find((s) => s.id === req.user.profileId);
    if (a.className !== student?.className) {
      return res.status(403).json({ message: 'Not your class' });
    }
    const sub = assignmentSubmissions.find(
      (s) => s.assignmentId === a.id && s.studentId === req.user.profileId
    );
    return res.json({ ...a, mySubmission: sub || null });
  }

  // teacher / admin: full submissions
  const subs = assignmentSubmissions.filter((s) => s.assignmentId === a.id);
  res.json({ ...a, submissions: subs });
});

/* POST /api/assignments — teacher creates */
router.post('/', allow('teacher'), (req, res) => {
  const { title, subject, className, description, dueDate, totalMarks } = req.body;
  if (!title || !className) {
    return res.status(400).json({ message: 'Title and class are required' });
  }

  const teacher = teachers.find((t) => t.id === req.user.profileId);
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  const assignment = {
    id: nextId(assignments),
    teacherId: teacher.id,
    teacherName: teacher.name,
    title,
    subject: subject || teacher.subjects[0] || 'General',
    className,
    description: description || '',
    dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalMarks: Number(totalMarks) || 10,
    createdAt: new Date().toISOString()
  };

  assignments.push(assignment);

  notifyClassStudents(className, {
    type: 'assignment',
    title: 'New assignment',
    body: `${teacher.name} posted "${title}"`,
    link: '/student/assignments'
  });

  res.status(201).json({ message: 'Assignment created', assignment });
});

/* DELETE /api/assignments/:id */
router.delete('/:id', allow('teacher'), (req, res) => {
  const idx = assignments.findIndex(
    (a) => a.id === Number(req.params.id) && a.teacherId === req.user.profileId
  );
  if (idx === -1) return res.status(404).json({ message: 'Assignment not found' });

  const [removed] = assignments.splice(idx, 1);
  for (let i = assignmentSubmissions.length - 1; i >= 0; i--) {
    if (assignmentSubmissions[i].assignmentId === removed.id) {
      const sub = assignmentSubmissions[i];
      if (sub.fileName) {
        const fp = path.join(uploadDir, sub.fileName);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      assignmentSubmissions.splice(i, 1);
    }
  }

  res.json({ message: 'Assignment deleted' });
});

/* POST /api/assignments/:id/submit — student submits */
router.post('/:id/submit', allow('student'), upload.single('file'), (req, res) => {
  const a = assignments.find((x) => x.id === Number(req.params.id));
  if (!a) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const student = students.find((s) => s.id === req.user.profileId);
  if (!student || a.className !== student.className) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ message: 'Not your class' });
  }

  const text = String(req.body.text || '').trim();
  if (!text && !req.file) {
    return res.status(400).json({ message: 'Submit text or a file' });
  }

  const existingIdx = assignmentSubmissions.findIndex(
    (s) => s.assignmentId === a.id && s.studentId === student.id
  );

  // Remove previous file if resubmitting
  if (existingIdx !== -1 && assignmentSubmissions[existingIdx].fileName) {
    const oldPath = path.join(uploadDir, assignmentSubmissions[existingIdx].fileName);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const submission = {
    id: existingIdx !== -1 ? assignmentSubmissions[existingIdx].id : nextId(assignmentSubmissions),
    assignmentId: a.id,
    studentId: student.id,
    studentName: student.name,
    text,
    fileName: req.file ? req.file.filename : null,
    originalName: req.file ? req.file.originalname : null,
    fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
    submittedAt: new Date().toISOString(),
    score: null,
    feedback: null,
    gradedAt: null
  };

  if (existingIdx !== -1) {
    assignmentSubmissions[existingIdx] = submission;
  } else {
    assignmentSubmissions.push(submission);
  }

  // Notify the teacher
  const teacher = teachers.find((t) => t.id === a.teacherId);
  if (teacher && teacher.userId) {
    notify({
      userId: teacher.userId,
      type: 'submission',
      title: 'New assignment submission',
      body: `${student.name} submitted "${a.title}"`,
      link: '/teacher/assignments'
    });
  }

  res.json({ message: 'Submission received', submission });
});

/* POST /api/assignments/:id/grade/:studentId — teacher grades */
router.post('/:id/grade/:studentId', allow('teacher'), (req, res) => {
  const a = assignments.find(
    (x) => x.id === Number(req.params.id) && x.teacherId === req.user.profileId
  );
  if (!a) return res.status(404).json({ message: 'Assignment not found' });

  const sub = assignmentSubmissions.find(
    (s) => s.assignmentId === a.id && s.studentId === Number(req.params.studentId)
  );
  if (!sub) return res.status(404).json({ message: 'Submission not found' });

  const score = Number(req.body.score);
  if (isNaN(score) || score < 0 || score > a.totalMarks) {
    return res.status(400).json({ message: `Score must be between 0 and ${a.totalMarks}` });
  }

  sub.score = score;
  sub.feedback = String(req.body.feedback || '').trim();
  sub.gradedAt = new Date().toISOString();

  // Notify the student
  const student = students.find((s) => s.id === sub.studentId);
  if (student && student.userId) {
    notify({
      userId: student.userId,
      type: 'grade',
      title: 'Assignment graded',
      body: `"${a.title}" scored ${score}/${a.totalMarks}`,
      link: '/student/assignments'
    });
  }

  res.json({ message: 'Graded', submission: sub });
});

module.exports = router;