const router = require('express').Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getTeacherContext, canTeach } = require('../utils/teacherContext');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.originalname.match(/\.(xlsx|xls|csv)$/i);
    cb(ok ? null : new Error('Only .xlsx, .xls or .csv allowed'), ok);
  },
});

/* ==========================================================================
   STUDENT ENDPOINTS
   ========================================================================== */

router.get('/quizzes', protect, allow('student'), async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT id, class_name FROM students WHERE user_id = ?', [req.user.id]
  );
  if (!studentRows.length) return res.json([]);
  const { id: studentId, class_name: className } = studentRows[0];

  const [quizzes] = await pool.execute('SELECT * FROM quizzes WHERE class_name = ?', [className]);
  const [submissions] = await pool.execute('SELECT * FROM quiz_submissions WHERE student_id = ?', [studentId]);

  res.json(quizzes.map((q) => {
    const sub = submissions.find((s) => s.quiz_id === q.id);
    return {
      id: q.id, title: q.title, subject: q.subject,
      duration: q.duration, dueDate: q.due_date,
      questionCount: JSON.parse(q.questions || '[]').length,
      completed: !!sub,
      score: sub ? sub.score : null,
      total: sub ? sub.total : null,
    };
  }));
});

router.get('/quizzes/:id', protect, allow('student'), async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Quiz not found' });
  const quiz = rows[0];
  res.json({
    id: quiz.id, title: quiz.title, subject: quiz.subject,
    duration: quiz.duration, dueDate: quiz.due_date,
    questions: JSON.parse(quiz.questions || '[]').map((q) => ({
      id: q.id, question: q.question, options: q.options,
    })),
  });
});

router.post('/quizzes/:id/submit', protect, allow('student'), async (req, res) => {
  const [quizRows] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!quizRows.length) return res.status(404).json({ message: 'Quiz not found' });
  const questions = JSON.parse(quizRows[0].questions || '[]');

  const { answers } = req.body;
  if (!answers) return res.status(400).json({ message: 'No answers submitted' });

  let score = 0;
  questions.forEach((q) => {
    if (Number(answers[q.id]) === q.answer) score += 1;
  });

  const [sRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
  if (!sRows.length) return res.status(404).json({ message: 'Student not found' });
  const studentId = sRows[0].id;

  const [existing] = await pool.execute(
    'SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?',
    [quizRows[0].id, studentId]
  );

  if (existing.length) {
    await pool.execute(
      'UPDATE quiz_submissions SET score = ?, date = CURDATE() WHERE id = ?',
      [score, existing[0].id]
    );
  } else {
    await pool.execute(
      'INSERT INTO quiz_submissions (quiz_id, student_id, score, total, date) VALUES (?, ?, ?, ?, CURDATE())',
      [quizRows[0].id, studentId, score, questions.length]
    );
  }

  res.json({ message: 'Quiz submitted', score, total: questions.length });
});

/* ==========================================================================
   TEACHER — MANUAL quiz creation
   Now takes className + subject from the request, validates against ctx.
   ========================================================================== */
router.post('/quizzes', protect, allow('teacher'), async (req, res) => {
  const { title, subject, className, duration, dueDate, questions } = req.body;

  if (!title || !subject || !className || !questions || !questions.length) {
    return res.status(400).json({
      message: 'title, subject, className and at least one question are required',
    });
  }

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({
      message: `You are not assigned to teach ${subject} in ${className}`,
    });
  }

  const formattedQuestions = questions.map((q, i) => ({
    id: i + 1,
    question: q.question,
    options: q.options,
    answer: Number(q.answer),
  }));

  const [result] = await pool.execute(
    `INSERT INTO quizzes (title, subject, class_name, teacher_id, duration, due_date, questions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title, subject, className, ctx.teacherId,
      Number(duration) || 10,
      dueDate || new Date().toISOString().split('T')[0],
      JSON.stringify(formattedQuestions),
    ]
  );

  const [rows] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Quiz created', quiz: rows[0] });
});

/* ==========================================================================
   TEACHER — BULK quiz creation
   ========================================================================== */
router.post('/quizzes/bulk', protect, allow('teacher'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const { title, subject, className, duration, dueDate } = req.body;
  if (!title || !subject || !className) {
    return res.status(400).json({ message: 'title, subject and className are required' });
  }

  let rows;
  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  } catch (err) {
    return res.status(400).json({ message: 'Could not read file: ' + err.message });
  }
  if (!rows.length) return res.status(400).json({ message: 'Spreadsheet is empty' });

  const normalize = (raw) => {
    const out = {};
    Object.keys(raw).forEach((k) => {
      out[String(k).toLowerCase().replace(/[\s_-]/g, '')] = raw[k];
    });
    return out;
  };

  const parseAnswer = (val, options) => {
    const v = String(val).trim().toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(v)) return 'ABCD'.indexOf(v);
    const n = Number(v);
    if (!isNaN(n)) {
      if (n >= 1 && n <= 4) return n - 1;
      if (n >= 0 && n <= 3) return n;
    }
    const idx = options.findIndex((o) => String(o).trim().toLowerCase() === v.toLowerCase());
    return idx >= 0 ? idx : 0;
  };

  const questions = [];
  const errors = [];

  rows.forEach((raw, i) => {
    const r = normalize(raw);
    const line = i + 2;

    const question = String(r.question || '').trim();
    const opt1 = String(r.option1 || r.a || '').trim();
    const opt2 = String(r.option2 || r.b || '').trim();
    const opt3 = String(r.option3 || r.c || '').trim();
    const opt4 = String(r.option4 || r.d || '').trim();
    const correct = r.correct || r.answer || 'A';

    if (!question || !opt1 || !opt2) {
      errors.push(`Row ${line}: missing question or options`);
      return;
    }

    const options = [opt1, opt2, opt3 || '', opt4 || ''].filter(Boolean);
    while (options.length < 4) options.push(`Option ${options.length + 1}`);

    questions.push({
      id: questions.length + 1,
      question,
      options,
      answer: parseAnswer(correct, options),
    });
  });

  if (!questions.length) {
    return res.status(400).json({ message: 'No valid questions found in the file', errors });
  }

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({
      message: `You are not assigned to teach ${subject} in ${className}`,
    });
  }

  const [result] = await pool.execute(
    `INSERT INTO quizzes (title, subject, class_name, teacher_id, duration, due_date, questions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title, subject, className, ctx.teacherId,
      Number(duration) || 10,
      dueDate || new Date().toISOString().split('T')[0],
      JSON.stringify(questions),
    ]
  );

  const [inserted] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [result.insertId]);

  res.status(201).json({
    message: `Quiz created with ${questions.length} question(s)`,
    quiz: inserted[0], questionCount: questions.length,
    skipped: errors.length, errors,
  });
});

/* ==========================================================================
   TEACHER — my quizzes
   ========================================================================== */
router.get('/my-quizzes', protect, allow('teacher'), async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);

  const [rows] = await pool.execute(
    'SELECT * FROM quizzes WHERE teacher_id = ?', [ctx.teacherId]
  );
  res.json(rows.map((q) => ({
    id: q.id, title: q.title, subject: q.subject, className: q.class_name,
    duration: q.duration, dueDate: q.due_date,
    questionCount: JSON.parse(q.questions || '[]').length,
  })));
});

module.exports = router;