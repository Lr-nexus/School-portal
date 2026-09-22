const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.get('/quizzes', protect, allow('student'), async (req, res) => {
  const [studentRows] = await pool.execute('SELECT id, class_name FROM students WHERE user_id = ?', [req.user.id]);
  if (!studentRows.length) return res.json([]);
  const { id: studentId, class_name: className } = studentRows[0];

  const [quizzes] = await pool.execute('SELECT * FROM quizzes WHERE class_name = ?', [className]);
  const [submissions] = await pool.execute('SELECT * FROM quiz_submissions WHERE student_id = ?', [studentId]);

  res.json(quizzes.map(q => {
    const sub = submissions.find(s => s.quiz_id === q.id);
    return {
      id: q.id, title: q.title, subject: q.subject, duration: q.duration,
      dueDate: q.due_date,
      questionCount: JSON.parse(q.questions || '[]').length,
      completed: !!sub, score: sub ? sub.score : null, total: sub ? sub.total : null,
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
    questions: JSON.parse(quiz.questions || '[]').map(q => ({ id: q.id, question: q.question, options: q.options })),
  });
});

router.post('/quizzes/:id/submit', protect, allow('student'), async (req, res) => {
  const [quizRows] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
  if (!quizRows.length) return res.status(404).json({ message: 'Quiz not found' });
  const questions = JSON.parse(quizRows[0].questions || '[]');

  const { answers } = req.body;
  if (!answers) return res.status(400).json({ message: 'No answers submitted' });

  let score = 0;
  questions.forEach(q => { if (Number(answers[q.id]) === q.answer) score += 1; });

  const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
  if (!studentRows.length) return res.status(404).json({ message: 'Student not found' });
  const studentId = studentRows[0].id;

  const [existing] = await pool.execute(
    'SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?',
    [quizRows[0].id, studentId]
  );

  if (existing.length) {
    await pool.execute('UPDATE quiz_submissions SET score = ?, date = CURDATE() WHERE id = ?', [score, existing[0].id]);
  } else {
    await pool.execute(
      'INSERT INTO quiz_submissions (quiz_id, student_id, score, total, date) VALUES (?, ?, ?, ?, CURDATE())',
      [quizRows[0].id, studentId, score, questions.length]
    );
  }

  res.json({ message: 'Quiz submitted', score, total: questions.length });
});

router.post('/quizzes', protect, allow('teacher'), async (req, res) => {
  const { title, subject, className, duration, dueDate, questions } = req.body;
  if (!title || !subject || !questions || !questions.length) {
    return res.status(400).json({ message: 'Title, subject and at least one question are required' });
  }

  const [teacherRows] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
  if (!teacherRows.length) return res.status(404).json({ message: 'Teacher not found' });

  const formatted = questions.map((q, i) => ({
    id: i + 1, question: q.question, options: q.options, answer: Number(q.answer),
  }));

  const [result] = await pool.execute(
    `INSERT INTO quizzes (title, subject, class_name, teacher_id, duration, due_date, questions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, subject, className || 'JSS 2A', teacherRows[0].id, Number(duration) || 10,
     dueDate || new Date().toISOString().split('T')[0], JSON.stringify(formatted)]
  );

  const [rows] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Quiz created', quiz: rows[0] });
});

router.get('/my-quizzes', protect, allow('teacher'), async (req, res) => {
  const [teacherRows] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
  if (!teacherRows.length) return res.json([]);

  const [rows] = await pool.execute('SELECT * FROM quizzes WHERE teacher_id = ?', [teacherRows[0].id]);
  res.json(rows.map(q => ({
    id: q.id, title: q.title, subject: q.subject, className: q.class_name,
    duration: q.duration, dueDate: q.due_date,
    questionCount: JSON.parse(q.questions || '[]').length,
  })));
});

module.exports = router;