const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* Global search — searches across the user's role scope */
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const like = `%${q}%`;
  const role = req.user.role;
  const userId = req.user.id;
  const results = [];

  try {
    if (role === 'student') {
      const [studentRows] = await pool.execute(
        'SELECT id, class_name FROM students WHERE user_id = ?',
        [userId]
      );
      const className = studentRows[0]?.class_name;

      const [notes] = await pool.execute(
        `SELECT id, title, subject FROM notes
         WHERE class_name = ? AND (title LIKE ? OR subject LIKE ? OR description LIKE ?)
         LIMIT 5`,
        [className, like, like, like]
      );
      notes.forEach((n) => results.push({
        type: 'note', icon: 'file',
        title: n.title, subtitle: `Note · ${n.subject}`,
        link: '/student/notes'
      }));

      const [assignments] = await pool.execute(
        `SELECT id, title, subject FROM assignments
         WHERE class_name = ? AND (title LIKE ? OR subject LIKE ? OR description LIKE ?)
         LIMIT 5`,
        [className, like, like, like]
      );
      assignments.forEach((a) => results.push({
        type: 'assignment', icon: 'clipboard',
        title: a.title, subtitle: `Assignment · ${a.subject}`,
        link: '/student/assignments'
      }));

      const [quizzes] = await pool.execute(
        `SELECT id, title, subject FROM quizzes
         WHERE class_name = ? AND (title LIKE ? OR subject LIKE ?)
         LIMIT 5`,
        [className, like, like]
      );
      quizzes.forEach((qz) => results.push({
        type: 'quiz', icon: 'edit',
        title: qz.title, subtitle: `Quiz · ${qz.subject}`,
        link: '/student/lms'
      }));
    }

    if (role === 'teacher') {
      const [teacherRows] = await pool.execute(
        'SELECT id, form_class FROM teachers WHERE user_id = ?',
        [userId]
      );
      const teacherId = teacherRows[0]?.id;

      const [students] = await pool.execute(
        `SELECT s.id, s.name, s.admission_no, s.class_name
         FROM students s
         JOIN classes c ON c.name = s.class_name
         WHERE c.teacher_id = ? AND (s.name LIKE ? OR s.admission_no LIKE ?)
         LIMIT 5`,
        [teacherId, like, like]
      );
      students.forEach((s) => results.push({
        type: 'student', icon: 'user',
        title: s.name, subtitle: `Student · ${s.class_name} · ${s.admission_no}`,
        link: '/teacher/students'
      }));

      const [notes] = await pool.execute(
        `SELECT id, title, subject, class_name FROM notes
         WHERE teacher_id = ? AND (title LIKE ? OR subject LIKE ?)
         LIMIT 5`,
        [teacherId, like, like]
      );
      notes.forEach((n) => results.push({
        type: 'note', icon: 'file',
        title: n.title, subtitle: `Note · ${n.subject} · ${n.class_name}`,
        link: '/teacher/notes'
      }));

      const [assignments] = await pool.execute(
        `SELECT id, title, subject FROM assignments
         WHERE teacher_id = ? AND (title LIKE ? OR subject LIKE ?)
         LIMIT 5`,
        [teacherId, like, like]
      );
      assignments.forEach((a) => results.push({
        type: 'assignment', icon: 'clipboard',
        title: a.title, subtitle: `Assignment · ${a.subject}`,
        link: '/teacher/assignments'
      }));
    }

    if (role === 'admin') {
      const [students] = await pool.execute(
        `SELECT id, name, admission_no, class_name FROM students
         WHERE name LIKE ? OR admission_no LIKE ? OR email LIKE ?
         LIMIT 5`,
        [like, like, like]
      );
      students.forEach((s) => results.push({
        type: 'student', icon: 'user',
        title: s.name, subtitle: `Student · ${s.class_name} · ${s.admission_no}`,
        link: '/admin/users'
      }));

      const [teachers] = await pool.execute(
        `SELECT id, name, staff_no, email FROM teachers
         WHERE name LIKE ? OR staff_no LIKE ? OR email LIKE ?
         LIMIT 5`,
        [like, like, like]
      );
      teachers.forEach((t) => results.push({
        type: 'teacher', icon: 'user-check',
        title: t.name, subtitle: `Teacher · ${t.staff_no}`,
        link: '/admin/users'
      }));

      const [classes] = await pool.execute(
        'SELECT id, name FROM classes WHERE name LIKE ? LIMIT 5',
        [like]
      );
      classes.forEach((c) => results.push({
        type: 'class', icon: 'layers',
        title: c.name, subtitle: 'Class',
        link: '/admin/classes'
      }));

      const [fees] = await pool.execute(
        `SELECT DISTINCT reference, session, term FROM fees
         WHERE reference LIKE ? OR session LIKE ? OR term LIKE ?
         LIMIT 5`,
        [like, like, like]
      );
      fees.forEach((f) => results.push({
        type: 'fee', icon: 'credit-card',
        title: f.reference, subtitle: `Fee · ${f.session} · ${f.term}`,
        link: '/admin/fees'
      }));
    }

    // Announcements — everyone sees them
    const [anns] = await pool.execute(
      `SELECT id, title, category FROM announcements
       WHERE title LIKE ? OR body LIKE ?
       ORDER BY date DESC LIMIT 5`,
      [like, like]
    );
    anns.forEach((a) => results.push({
      type: 'announcement', icon: 'bell',
      title: a.title, subtitle: `Announcement${a.category ? ' · ' + a.category : ''}`,
      link: `/${role}/announcements`
    }));

    res.json({ results, query: q });
  } catch (err) {
    console.error('Search failed:', err);
    res.status(500).json({ message: err.message || 'Search failed' });
  }
});

module.exports = router;