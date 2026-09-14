const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db');
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
router.get('/', async (req, res) => {
  let query = 'SELECT * FROM assignments';
  const params = [];

  if (req.user.role === 'student') {
    const [studentRows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (!studentRows.length) return res.json([]);
    query += ' WHERE class_name = ?';
    params.push(studentRows[0].class_name);
  } else if (req.user.role === 'teacher') {
    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ?',
      [req.user.id]
    );
    if (!teacherRows.length) return res.json([]);
    query += ' WHERE teacher_id = ?';
    params.push(teacherRows[0].id);
  }

  query += ' ORDER BY created_at DESC';

  const [assignments] = await pool.execute(query, params);

  const enriched = await Promise.all(assignments.map(async (a) => {
    const [[{ submissionCount }]] = await pool.execute(
      'SELECT COUNT(*) as submissionCount FROM assignment_submissions WHERE assignment_id = ?',
      [a.id]
    );

    let mySubmission = null;
    if (req.user.role === 'student') {
      const [studentRows] = await pool.execute(
        'SELECT id FROM students WHERE user_id = ?',
        [req.user.id]
      );
      if (studentRows.length) {
        const [subs] = await pool.execute(
          'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
          [a.id, studentRows[0].id]
        );
        if (subs.length) mySubmission = subs[0];
      }
    }

    return {
      id: a.id,
      teacherId: a.teacher_id,
      title: a.title,
      subject: a.subject,
      className: a.class_name,
      description: a.description,
      dueDate: a.due_date,
      totalMarks: a.total_marks,
      createdAt: a.created_at,
      submissionCount,
      mySubmission,
    };
  }));

  res.json(enriched);
});

/* GET /api/assignments/:id */
router.get('/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM assignments WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Assignment not found' });
  const a = rows[0];

  if (req.user.role === 'student') {
    const [studentRows] = await pool.execute(
      'SELECT id, class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (!studentRows.length || studentRows[0].class_name !== a.class_name) {
      return res.status(403).json({ message: 'Not your class' });
    }
    const [subs] = await pool.execute(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
      [a.id, studentRows[0].id]
    );
    return res.json({
      ...a,
      mySubmission: subs.length ? subs[0] : null,
    });
  }

  const [subs] = await pool.execute(
    'SELECT * FROM assignment_submissions WHERE assignment_id = ?',
    [a.id]
  );
  res.json({ ...a, submissions: subs });
});

/* POST /api/assignments — teacher creates */
router.post('/', allow('teacher'), async (req, res) => {
  const { title, subject, className, description, dueDate, totalMarks } = req.body;
  if (!title || !className) {
    return res.status(400).json({ message: 'Title and class are required' });
  }

  const [teacherRows] = await pool.execute(
    'SELECT id, name FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!teacherRows.length) return res.status(404).json({ message: 'Teacher not found' });
  const { id: teacherId, name: teacherName } = teacherRows[0];

  const [result] = await pool.execute(
    `INSERT INTO assignments (teacher_id, title, subject, class_name, description, due_date, total_marks, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      teacherId,
      title,
      subject || 'General',
      className,
      description || '',
      dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Number(totalMarks) || 10,
    ]
  );

  await notifyClassStudents(className, {
    type: 'assignment',
    title: 'New assignment',
    body: `${teacherName} posted "${title}"`,
    link: '/student/assignments',
  });

  const [rows] = await pool.execute('SELECT * FROM assignments WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Assignment created', assignment: rows[0] });
});

/* DELETE /api/assignments/:id */
router.delete('/:id', allow('teacher'), async (req, res) => {
  const [teacherRows] = await pool.execute(
    'SELECT id FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!teacherRows.length) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM assignments WHERE id = ? AND teacher_id = ?',
    [req.params.id, teacherRows[0].id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Assignment not found' });

  const [subs] = await pool.execute(
    'SELECT file_name FROM assignment_submissions WHERE assignment_id = ?',
    [req.params.id]
  );
  subs.forEach((s) => {
    if (s.file_name) {
      const fp = path.join(uploadDir, s.file_name);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });

  await pool.execute('DELETE FROM assignments WHERE id = ?', [req.params.id]);
  res.json({ message: 'Assignment deleted' });
});

/* POST /api/assignments/:id/submit — student submits */
router.post('/:id/submit', allow('student'), upload.single('file'), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM assignments WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: 'Assignment not found' });
  }
  const a = rows[0];

  const [studentRows] = await pool.execute(
    'SELECT id, name, class_name FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length || studentRows[0].class_name !== a.class_name) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ message: 'Not your class' });
  }
  const student = studentRows[0];

  const text = String(req.body.text || '').trim();
  if (!text && !req.file) {
    return res.status(400).json({ message: 'Submit text or a file' });
  }

  const [existing] = await pool.execute(
    'SELECT id, file_name FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
    [a.id, student.id]
  );

  if (existing.length && existing[0].file_name) {
    const oldPath = path.join(uploadDir, existing[0].file_name);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  if (existing.length) {
    await pool.execute(
      `UPDATE assignment_submissions
       SET text = ?, file_name = ?, original_name = ?, file_url = ?, submitted_at = NOW(),
           score = NULL, feedback = NULL, graded_at = NULL
       WHERE id = ?`,
      [
        text,
        req.file?.filename || null,
        req.file?.originalname || null,
        req.file ? `/uploads/${req.file.filename}` : null,
        existing[0].id,
      ]
    );
  } else {
    await pool.execute(
      `INSERT INTO assignment_submissions (assignment_id, student_id, text, file_name, original_name, file_url, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        a.id,
        student.id,
        text,
        req.file?.filename || null,
        req.file?.originalname || null,
        req.file ? `/uploads/${req.file.filename}` : null,
      ]
    );
  }

  const [teacherRows] = await pool.execute(
    'SELECT user_id FROM teachers WHERE id = ?',
    [a.teacher_id]
  );
  if (teacherRows.length && teacherRows[0].user_id) {
    await notify({
      userId: teacherRows[0].user_id,
      type: 'submission',
      title: 'New assignment submission',
      body: `${student.name} submitted "${a.title}"`,
      link: '/teacher/assignments',
    });
  }

  const [subs] = await pool.execute(
    'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
    [a.id, student.id]
  );

  res.json({ message: 'Submission received', submission: subs[0] });
});

/* POST /api/assignments/:id/grade/:studentId — teacher grades */
router.post('/:id/grade/:studentId', allow('teacher'), async (req, res) => {
  const [teacherRows] = await pool.execute(
    'SELECT id FROM teachers WHERE user_id = ?',
    [req.user.id]
  );
  if (!teacherRows.length) return res.status(404).json({ message: 'Teacher not found' });

  const [aRows] = await pool.execute(
    'SELECT * FROM assignments WHERE id = ? AND teacher_id = ?',
    [req.params.id, teacherRows[0].id]
  );
  if (!aRows.length) return res.status(404).json({ message: 'Assignment not found' });
  const a = aRows[0];

  const [subRows] = await pool.execute(
    'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
    [a.id, req.params.studentId]
  );
  if (!subRows.length) return res.status(404).json({ message: 'Submission not found' });

  const score = Number(req.body.score);
  if (isNaN(score) || score < 0 || score > a.total_marks) {
    return res.status(400).json({ message: `Score must be between 0 and ${a.total_marks}` });
  }

  await pool.execute(
    'UPDATE assignment_submissions SET score = ?, feedback = ?, graded_at = NOW() WHERE id = ?',
    [score, String(req.body.feedback || '').trim(), subRows[0].id]
  );

  const [studentRows] = await pool.execute(
    'SELECT user_id, name FROM students WHERE id = ?',
    [req.params.studentId]
  );
  if (studentRows.length && studentRows[0].user_id) {
    await notify({
      userId: studentRows[0].user_id,
      type: 'grade',
      title: 'Assignment graded',
      body: `"${a.title}" scored ${score}/${a.total_marks}`,
      link: '/student/assignments',
    });
  }

  const [updated] = await pool.execute(
    'SELECT * FROM assignment_submissions WHERE id = ?',
    [subRows[0].id]
  );

  res.json({ message: 'Graded', submission: updated[0] });
});

module.exports = router;