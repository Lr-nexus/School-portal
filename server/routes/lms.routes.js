const router = require('express').Router();
const { quizzes, submissions, students, nextId } = require('../data/db');
const { protect, allow } = require('../middleware/auth');

router.get('/quizzes', protect, allow('student'), (req, res) => {
  const student = students.find((s) => s.id === req.user.profileId);
  const list = quizzes
    .filter((q) => q.className === student.className)
    .map((q) => {
      const sub = submissions.find(
        (s) => s.quizId === q.id && s.studentId === student.id
      );
      return {
        id: q.id, title: q.title, subject: q.subject, duration: q.duration,
        dueDate: q.dueDate, questionCount: q.questions.length,
        completed: !!sub,
        score: sub ? sub.score : null,
        total: sub ? sub.total : null
      };
    });
  res.json(list);
});

router.get('/quizzes/:id', protect, allow('student'), (req, res) => {
  const quiz = quizzes.find((q) => q.id === Number(req.params.id));
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

  res.json({
    id: quiz.id, title: quiz.title, subject: quiz.subject,
    duration: quiz.duration, dueDate: quiz.dueDate,
    questions: quiz.questions.map((q) => ({
      id: q.id, question: q.question, options: q.options
    }))
  });
});

router.post('/quizzes/:id/submit', protect, allow('student'), (req, res) => {
  const quiz = quizzes.find((q) => q.id === Number(req.params.id));
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

  const { answers } = req.body;
  if (!answers) return res.status(400).json({ message: 'No answers submitted' });

  let score = 0;
  quiz.questions.forEach((q) => {
    if (Number(answers[q.id]) === q.answer) score += 1;
  });

  const existing = submissions.find(
    (s) => s.quizId === quiz.id && s.studentId === req.user.profileId
  );

  if (existing) {
    existing.score = score;
    existing.date = new Date().toISOString().split('T')[0];
  } else {
    submissions.push({
      id: nextId(submissions),
      quizId: quiz.id,
      studentId: req.user.profileId,
      score,
      total: quiz.questions.length,
      date: new Date().toISOString().split('T')[0]
    });
  }

  res.json({ message: 'Quiz submitted', score, total: quiz.questions.length });
});

router.post('/quizzes', protect, allow('teacher'), (req, res) => {
  const { title, subject, className, duration, dueDate, questions } = req.body;

  if (!title || !subject || !questions || !questions.length) {
    return res.status(400).json({ message: 'Title, subject and at least one question are required' });
  }

  const quiz = {
    id: nextId(quizzes),
    title, subject,
    className: className || 'JSS 2A',
    teacherId: req.user.profileId,
    duration: Number(duration) || 10,
    dueDate: dueDate || new Date().toISOString().split('T')[0],
    questions: questions.map((q, i) => ({
      id: i + 1,
      question: q.question,
      options: q.options,
      answer: Number(q.answer)
    }))
  };

  quizzes.push(quiz);
  res.status(201).json({ message: 'Quiz created', quiz });
});

router.get('/my-quizzes', protect, allow('teacher'), (req, res) => {
  const mine = quizzes
    .filter((q) => q.teacherId === req.user.profileId)
    .map((q) => ({ ...q, questionCount: q.questions.length }));

  res.json(mine);
});

module.exports = router;