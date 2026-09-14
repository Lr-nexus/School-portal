const router = require('express').Router();
const {
  admins, students, teachers, results, announcements,
  quizzes, submissions, nextId
} = require('../data/db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');
const { notifyAllUsers } = require('../utils/notify');

router.use(protect, allow('admin'));

// ---------- PROFILE ----------
router.get('/me', (req, res) => {
  const admin = admins.find((a) => a.id === req.user.profileId);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });
  res.json(admin);
});

// ---------- UPDATE OWN PROFILE ----------
router.patch('/me', (req, res) => {
  const admin = admins.find((a) => a.id === req.user.profileId);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const editable = ['name', 'email', 'phone', 'office', 'title'];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) admin[field] = req.body[field];
  });

  res.json({ message: 'Profile updated', admin });
});

// ---------- DASHBOARD STATS ----------
router.get('/stats', (req, res) => {
  res.json({
    totalStudents: students.length,
    totalTeachers: teachers.length,
    totalQuizzes: quizzes.length,
    totalSubmissions: submissions.length,
    announcements
  });
});

// ---------- STUDENTS ----------
router.get('/students', (req, res) => res.json(students));

router.post('/students', (req, res) => {
  const { name, className, gender, guardianName, guardianPhone, email } = req.body;
  if (!name || !className) {
    return res.status(400).json({ message: 'Name and class are required' });
  }

  const student = {
    id: nextId(students),
    userId: null,
    name,
    admissionNo: `STD/2025/${String(students.length + 1).padStart(3, '0')}`,
    className,
    gender: gender || 'Not specified',
    dob: '',
    guardianName: guardianName || '',
    guardianPhone: guardianPhone || '',
    address: '',
    email: email || '',
    photo: '',
    house: 'Unassigned'
  };

  students.push(student);
  res.status(201).json({ message: 'Student added', student });
});

// ---------- SINGLE STUDENT'S RESULTS ----------
router.get('/students/:id/results', (req, res) => {
  const student = students.find((s) => s.id === Number(req.params.id));
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const rows = results
    .filter((r) => r.studentId === student.id)
    .map((r) => {
      const total = totalOf(r);
      const { grade, remark } = gradeFor(total);
      return { ...r, total, grade, remark };
    });

  const average = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.total, 0) / rows.length)
    : 0;

  res.json({
    student: {
      id: student.id,
      name: student.name,
      className: student.className,
      admissionNo: student.admissionNo
    },
    session: rows[0]?.session || '2024/2025',
    term: rows[0]?.term || 'First Term',
    subjects: rows,
    average,
    overallGrade: gradeFor(average).grade
  });
});

// ---------- TEACHERS ----------
router.get('/teachers', (req, res) => res.json(teachers));

// ---------- ENROLL NEW TEACHER ----------
router.post('/teachers', (req, res) => {
  const { name, email, phone, subjects, formClass, qualification, address } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  const emailTaken = teachers.some(
    (t) => t.email.toLowerCase() === email.toLowerCase()
  );
  if (emailTaken) {
    return res.status(400).json({ message: 'A teacher with that email already exists' });
  }

  const subjectList = Array.isArray(subjects)
    ? subjects
    : String(subjects || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const teacher = {
    id: nextId(teachers),
    userId: null,
    name,
    staffNo: `TCH/${String(teachers.length + 1).padStart(3, '0')}`,
    email,
    phone: phone || '',
    subjects: subjectList,
    formClass: formClass || 'Unassigned',
    qualification: qualification || '',
    address: address || '',
    joined: new Date().toISOString().split('T')[0]
  };

  teachers.push(teacher);
  res.status(201).json({ message: 'Teacher enrolled', teacher });
});

// ---------- RESULTS (all students, flat table) ----------
router.get('/results', (req, res) => {
  const rows = results.map((r) => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    const student = students.find((s) => s.id === r.studentId);
    return {
      ...r, total, grade, remark,
      studentName: student?.name,
      className: student?.className
    };
  });
  res.json(rows);
});

// ---------- LMS PERFORMANCE ----------
router.get('/lms/performance', (req, res) => {
  const studentRows = students.map((s) => {
    const mySubs = submissions.filter((sub) => sub.studentId === s.id);
    const totalScore = mySubs.reduce((sum, sub) => sum + sub.score, 0);
    const totalQuestions = mySubs.reduce((sum, sub) => sum + sub.total, 0);
    const average = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0;

    return {
      id: s.id,
      name: s.name,
      className: s.className,
      quizzesTaken: mySubs.length,
      totalQuizzes: quizzes.filter((q) => q.className === s.className).length,
      score: totalScore,
      totalQuestions,
      average
    };
  });

  const quizRows = quizzes.map((q) => ({
    id: q.id,
    title: q.title,
    subject: q.subject,
    className: q.className,
    questionCount: q.questions.length,
    dueDate: q.dueDate,
    submissionCount: submissions.filter((s) => s.quizId === q.id).length
  }));

  res.json({ students: studentRows, quizzes: quizRows });
});

// ---------- ANNOUNCEMENTS ----------
router.get('/announcements', (req, res) => res.json(announcements));

router.post('/announcements', (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ message: 'Title and body are required' });
  }

  const item = {
    id: nextId(announcements),
    title,
    body,
    date: new Date().toISOString().split('T')[0],
    audience: 'all'
  };
  announcements.unshift(item);

  // 📣 Notify every user in the school
  notifyAllUsers({
    type: 'announcement',
    title: 'New announcement',
    body: `${title} — ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}`,
    link: `/${req.user.role}/home`
  });

  res.status(201).json({ message: 'Announcement posted', announcement: item });
});

module.exports = router;