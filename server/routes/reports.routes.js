const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');

router.use(protect);

/* Helper — can the caller view this student? */
async function canViewStudent(req, studentId) {
  const role = req.user.role;
  const userId = req.user.id;

  if (role === 'admin') return true;

  if (role === 'student') {
    const [rows] = await pool.execute(
      'SELECT id FROM students WHERE user_id = ? AND id = ?',
      [userId, studentId]
    );
    return rows.length > 0;
  }

  if (role === 'parent') {
    const [rows] = await pool.execute(
      `SELECT s.id FROM students s
       JOIN parents p ON p.id = s.parent_id
       WHERE p.user_id = ? AND s.id = ?`,
      [userId, studentId]
    );
    return rows.length > 0;
  }

  return false;
}

/* ============================================================
   GET /api/reports/report-card/:studentId?session=&term=
   ============================================================ */
router.get('/report-card/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await canViewStudent(req, studentId))) {
    return res.status(403).json({ message: 'You cannot view this student' });
  }

  const [studentRows] = await pool.execute(
    'SELECT * FROM students WHERE id = ?',
    [studentId]
  );
  if (!studentRows.length) return res.status(404).json({ message: 'Student not found' });
  const student = studentRows[0];

  // Session/term combos this student has
  const [combos] = await pool.execute(
    `SELECT DISTINCT session, term FROM results
     WHERE student_id = ? ORDER BY session DESC, term ASC`,
    [studentId]
  );

  let session = req.query.session;
  let term = req.query.term;
  if (!session || !term) {
    if (combos.length) {
      session = combos[0].session;
      term = combos[0].term;
    }
  }

  // Results for that session/term
  const [rows] = await pool.execute(
    `SELECT * FROM results WHERE student_id = ? AND session = ? AND term = ? ORDER BY subject`,
    [studentId, session, term]
  );

  const formatted = rows.map((r) => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    return { id: r.id, subject: r.subject, ca: r.ca, exam: r.exam, total, grade, remark };
  });

  const average = formatted.length
    ? Math.round(formatted.reduce((sum, r) => sum + r.total, 0) / formatted.length)
    : 0;

  // Position in class — rank all students in the same class by average for this session/term
  let position = null, classSize = null;
  if (student.class_name) {
    const [classStudents] = await pool.execute(
      'SELECT id FROM students WHERE class_name = ?',
      [student.class_name]
    );
    const classIds = classStudents.map((c) => c.id);

    if (classIds.length) {
      const placeholders = classIds.map(() => '?').join(',');
      const [allResults] = await pool.execute(
        `SELECT student_id, ca, exam FROM results
         WHERE student_id IN (${placeholders}) AND session = ? AND term = ?`,
        [...classIds, session, term]
      );

      // Group by student, compute averages
      const byStudent = {};
      allResults.forEach((r) => {
        if (!byStudent[r.student_id]) byStudent[r.student_id] = [];
        byStudent[r.student_id].push(totalOf(r));
      });

      const averages = Object.entries(byStudent).map(([sid, totals]) => ({
        studentId: Number(sid),
        avg: Math.round(totals.reduce((s, x) => s + x, 0) / totals.length),
      }));
      averages.sort((a, b) => b.avg - a.avg);

      classSize = averages.length;
      const idx = averages.findIndex((a) => a.studentId === studentId);
      if (idx !== -1) position = idx + 1;
    }
  }

  // Attendance rate
  const [[att]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
       COUNT(*) AS total
     FROM attendance WHERE student_id = ?`,
    [studentId]
  );
  const attendanceTotal = Number(att.total || 0);
  const attendancePresent = Number(att.present || 0);
  const attendanceRate = attendanceTotal
    ? Math.round((attendancePresent / attendanceTotal) * 100)
    : 0;

  // Class teacher name (form teacher of this student's class)
  const [classTeacherRows] = await pool.execute(
    `SELECT t.name FROM classes c
     JOIN teachers t ON t.id = c.teacher_id
     WHERE c.name = ? LIMIT 1`,
    [student.class_name]
  );
  const formTeacher = classTeacherRows[0]?.name || '—';

  res.json({
    school: {
      name: 'Bright Future Secondary School',
      address: '12 Learning Road, Ikeja, Lagos, Nigeria',
      phone: '+234 800 000 0000',
      email: 'office@brightfuture.edu.ng',
      motto: 'Knowledge · Character · Service',
    },
    student: {
      id: student.id,
      name: student.name,
      admissionNo: student.admission_no,
      className: student.class_name,
      gender: student.gender,
      house: student.house,
      dob: student.dob,
    },
    formTeacher,
    session: session || '—',
    term: term || '—',
    sessions: [...new Set(combos.map((c) => c.session))],
    terms: ['First Term', 'Second Term', 'Third Term'],
    subjects: formatted,
    totalSubjects: formatted.length,
    average,
    overallGrade: gradeFor(average).grade,
    overallRemark: gradeFor(average).remark,
    position,
    classSize,
    attendanceRate,
    issuedAt: new Date().toISOString().split('T')[0],
  });
});

/* ============================================================
   GET /api/reports/id-card/:studentId
   ============================================================ */
router.get('/id-card/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await canViewStudent(req, studentId))) {
    return res.status(403).json({ message: 'You cannot view this student' });
  }

  const [rows] = await pool.execute(
    'SELECT * FROM students WHERE id = ?',
    [studentId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Student not found' });
  const s = rows[0];

  res.json({
    school: {
      name: 'Bright Future Secondary School',
      address: '12 Learning Road, Ikeja, Lagos',
      phone: '+234 800 000 0000',
      motto: 'Knowledge · Character · Service',
    },
    student: {
      id: s.id,
      name: s.name,
      admissionNo: s.admission_no,
      className: s.class_name,
      gender: s.gender,
      dob: s.dob,
      house: s.house,
      photo: s.photo,
      guardianName: s.guardian_name,
      guardianPhone: s.guardian_phone,
      address: s.address,
    },
    validThrough: `${new Date().getFullYear() + 1}-08-31`,
    issuedAt: new Date().toISOString().split('T')[0],
  });
});

module.exports = router;