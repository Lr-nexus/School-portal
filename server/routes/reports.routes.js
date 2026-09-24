const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');

router.use(protect);

const SCHOOL_INFO = {
  name: 'Bright Future Secondary School',
  address: '12 Learning Road, Ikeja, Lagos, Nigeria',
  phone: '+234 800 000 0000',
  email: 'office@brightfuture.edu.ng',
  motto: 'Knowledge · Character · Service',
};

const ALL_TERMS = ['First Term', 'Second Term', 'Third Term'];

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

/* ==================================================================
   Single report card
   ================================================================== */
router.get('/report-card/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await canViewStudent(req, studentId))) {
    return res.status(403).json({ message: 'You cannot view this student' });
  }

  const [studentRows] = await pool.execute('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!studentRows.length) return res.status(404).json({ message: 'Student not found' });
  const student = studentRows[0];

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

  // Position in class
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

  const [[att]] = await pool.execute(
    `SELECT SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
            COUNT(*) AS total
     FROM attendance WHERE student_id = ?`,
    [studentId]
  );
  const attendanceTotal = Number(att.total || 0);
  const attendancePresent = Number(att.present || 0);
  const attendanceRate = attendanceTotal
    ? Math.round((attendancePresent / attendanceTotal) * 100)
    : 0;

  const [classTeacherRows] = await pool.execute(
    `SELECT t.name FROM classes c
     JOIN teachers t ON t.id = c.teacher_id
     WHERE c.name = ? LIMIT 1`,
    [student.class_name]
  );
  const formTeacher = classTeacherRows[0]?.name || '—';

  res.json({
    school: SCHOOL_INFO,
    student: {
      id: student.id, name: student.name,
      admissionNo: student.admission_no, className: student.class_name,
      gender: student.gender, house: student.house, dob: student.dob,
    },
    formTeacher,
    session: session || '—',
    term: term || '—',
    sessions: [...new Set(combos.map((c) => c.session))],
    terms: ALL_TERMS,
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

/* ==================================================================
   ⭐ Batch — every student's report card for one class
   GET /api/reports/class-report-cards/:className?session=&term=
   Admin only. Runs in ~5 queries regardless of class size.
   ================================================================== */
router.get('/class-report-cards/:className', allow('admin'), async (req, res) => {
  const className = decodeURIComponent(req.params.className);
  const sessionQ = req.query.session || null;
  const termQ = req.query.term || null;

  try {
    /* 1. All students in the class */
    const [students] = await pool.execute(
      'SELECT * FROM students WHERE class_name = ? ORDER BY name',
      [className]
    );

    if (!students.length) {
      return res.json({
        className,
        session: sessionQ, term: termQ,
        count: 0, cards: [],
      });
    }

    const studentIds = students.map((s) => s.id);
    const placeholders = studentIds.map(() => '?').join(',');

    /* 2. All their results */
    const [allResults] = await pool.execute(
      `SELECT * FROM results WHERE student_id IN (${placeholders})`,
      studentIds
    );

    /* 3. Pick session/term */
    let session = sessionQ;
    let term = termQ;
    if (!session || !term) {
      const sessionSet = [...new Set(allResults.map((r) => r.session))].sort().reverse();
      session = sessionSet[0] || null;
      if (session) {
        const termSet = [...new Set(allResults.filter((r) => r.session === session).map((r) => r.term))];
        term = termSet[0] || null;
      }
    }

    const filteredResults = allResults.filter(
      (r) => r.session === session && r.term === term
    );

    /* 4. Attendance for all students, one query */
    const [attendanceRows] = await pool.execute(
      `SELECT student_id,
              SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
              COUNT(*) AS total
       FROM attendance WHERE student_id IN (${placeholders})
       GROUP BY student_id`,
      studentIds
    );
    const attByStudent = {};
    attendanceRows.forEach((a) => { attByStudent[a.student_id] = a; });

    /* 5. Form teacher */
    const [teacherRows] = await pool.execute(
      `SELECT t.name FROM classes c
       JOIN teachers t ON t.id = c.teacher_id
       WHERE c.name = ? LIMIT 1`,
      [className]
    );
    const formTeacher = teacherRows[0]?.name || '—';

    /* 6. Build per-student cards */
    const perStudent = students.map((student) => {
      const rows = filteredResults.filter((r) => r.student_id === student.id);
      const formatted = rows.map((r) => {
        const total = totalOf(r);
        const { grade, remark } = gradeFor(total);
        return { id: r.id, subject: r.subject, ca: r.ca, exam: r.exam, total, grade, remark };
      });
      const average = formatted.length
        ? Math.round(formatted.reduce((sum, r) => sum + r.total, 0) / formatted.length)
        : 0;
      return { student, formatted, average };
    });

    /* 7. Class position — computed once */
    const ranked = perStudent
      .filter((p) => p.formatted.length > 0)
      .map((p) => ({ studentId: p.student.id, avg: p.average }))
      .sort((a, b) => b.avg - a.avg);
    const classSize = ranked.length;
    const posByStudent = {};
    ranked.forEach((x, i) => { posByStudent[x.studentId] = i + 1; });

    /* 8. Assemble final card objects */
    const cards = perStudent.map((p) => {
      const att = attByStudent[p.student.id];
      const attTotal = Number(att?.total || 0);
      const attPresent = Number(att?.present || 0);
      const attendanceRate = attTotal
        ? Math.round((attPresent / attTotal) * 100)
        : 0;

      return {
        school: SCHOOL_INFO,
        student: {
          id: p.student.id, name: p.student.name,
          admissionNo: p.student.admission_no, className: p.student.class_name,
          gender: p.student.gender, house: p.student.house, dob: p.student.dob,
        },
        formTeacher,
        session: session || '—',
        term: term || '—',
        subjects: p.formatted,
        totalSubjects: p.formatted.length,
        average: p.average,
        overallGrade: gradeFor(p.average).grade,
        overallRemark: gradeFor(p.average).remark,
        position: posByStudent[p.student.id] || null,
        classSize,
        attendanceRate,
        issuedAt: new Date().toISOString().split('T')[0],
      };
    });

    res.json({
      className,
      session: session || null,
      term: term || null,
      count: cards.length,
      cards,
    });
  } catch (err) {
    console.error('Batch report cards failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load report cards' });
  }
});

/* ==================================================================
   ID Card (unchanged)
   ================================================================== */
router.get('/id-card/:studentId', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await canViewStudent(req, studentId))) {
    return res.status(403).json({ message: 'You cannot view this student' });
  }

  const [rows] = await pool.execute('SELECT * FROM students WHERE id = ?', [studentId]);
  if (!rows.length) return res.status(404).json({ message: 'Student not found' });
  const s = rows[0];

  res.json({
    school: {
      name: SCHOOL_INFO.name,
      address: '12 Learning Road, Ikeja, Lagos',
      phone: SCHOOL_INFO.phone,
      motto: SCHOOL_INFO.motto,
    },
    student: {
      id: s.id, name: s.name, admissionNo: s.admission_no,
      className: s.class_name, gender: s.gender, dob: s.dob,
      house: s.house, photo: s.photo,
      guardianName: s.guardian_name, guardianPhone: s.guardian_phone,
      address: s.address,
    },
    validThrough: `${new Date().getFullYear() + 1}-08-31`,
    issuedAt: new Date().toISOString().split('T')[0],
  });
});

module.exports = router;