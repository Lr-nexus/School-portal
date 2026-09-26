const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getTeacherContext, teachablePairs } = require('../utils/teacherContext');

router.use(protect, allow('teacher'));

function parseSubjects(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }
}

/* ---------- PROFILE ---------- */
router.get('/me', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute('SELECT * FROM teachers WHERE id = ?', [ctx.teacherId]);
  const t = rows[0];

  res.json({
    id: t.id,
    name: t.name,
    staffNo: t.staff_no,
    email: t.email,
    phone: t.phone || '',
    subjects: parseSubjects(t.subjects),
    formClass: t.form_class || '',
    teacherType: t.teacher_type || 'class_teacher',
    assignments: ctx.assignments,
    qualification: t.qualification || '',
    address: t.address || '',
    joined: t.joined,
    photo: t.photo || null,
  });
});

/* ---------- UPDATE OWN PROFILE ---------- */
router.patch('/me', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const map = {
    name: 'name', email: 'email', phone: 'phone',
    formClass: 'form_class', qualification: 'qualification', address: 'address',
  };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (req.body.subjects !== undefined) {
    const subjects = Array.isArray(req.body.subjects)
      ? req.body.subjects
      : String(req.body.subjects).split(',').map((s) => s.trim()).filter(Boolean);
    updates.push('subjects = ?');
    values.push(JSON.stringify(subjects));
  }
  if (updates.length) {
    values.push(ctx.teacherId);
    await pool.execute(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  const userUpdates = [], userValues = [];
  if (req.body.name !== undefined)  { userUpdates.push('name = ?');  userValues.push(req.body.name); }
  if (req.body.email !== undefined) { userUpdates.push('email = ?'); userValues.push(String(req.body.email).toLowerCase()); }
  if (userUpdates.length) {
    userValues.push(req.user.id);
    await pool.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
  }

  const [rows] = await pool.execute('SELECT * FROM teachers WHERE id = ?', [ctx.teacherId]);
  const t = rows[0];
  res.json({
    message: 'Profile updated',
    teacher: {
      id: t.id, name: t.name, staffNo: t.staff_no, email: t.email,
      phone: t.phone || '', subjects: parseSubjects(t.subjects),
      formClass: t.form_class || '', teacherType: t.teacher_type,
      qualification: t.qualification || '', address: t.address || '',
      joined: t.joined, photo: t.photo || null,
    },
  });
});

/* ---------- MY TEACHING TARGETS (className, subject) ---------- */
router.get('/me/assignments', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);
  res.json(teachablePairs(ctx));
});

/* ---------- MY CLASSES ---------- */
router.get('/me/classes', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);

  const classNames = new Set();
  if (ctx.formClass) classNames.add(ctx.formClass);
  ctx.assignments.forEach((a) => classNames.add(a.className));

  if (!classNames.size) return res.json([]);

  const result = [];
  for (const cName of classNames) {
    const [clsRows] = await pool.execute('SELECT * FROM classes WHERE name = ?', [cName]);
    const [students] = await pool.execute(
      'SELECT id, name, admission_no, class_name FROM students WHERE class_name = ? ORDER BY name',
      [cName]
    );

    const classSubjects = ctx.assignments
      .filter((a) => a.className === cName)
      .map((a) => a.subject);

    result.push({
      id: clsRows[0]?.id,
      name: cName,
      subjects: classSubjects.length ? classSubjects : ctx.subjects,
      isFormClass: cName === ctx.formClass,
      students: students.map((s) => ({
        id: s.id, name: s.name, admissionNo: s.admission_no, className: s.class_name,
      })),
    });
  }

  res.json(result);
});

/* ---------- MY STUDENTS ---------- */
router.get('/me/students', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json({ formClass: null, classNames: [], students: [] });

  const classNames = new Set();
  if (ctx.formClass) classNames.add(ctx.formClass);
  ctx.assignments.forEach((a) => classNames.add(a.className));

  if (!classNames.size) {
    return res.json({
      formClass: null, teacherType: ctx.teacherType, classNames: [], students: [],
    });
  }

  const list = Array.from(classNames);
  const placeholders = list.map(() => '?').join(',');
  const [students] = await pool.execute(
    `SELECT id, name, admission_no, class_name, gender, email, guardian_name, guardian_phone
     FROM students WHERE class_name IN (${placeholders})
     ORDER BY class_name, name`,
    list
  );

  res.json({
    formClass: ctx.formClass || null,
    teacherType: ctx.teacherType,
    classNames: list,
    students: students.map((s) => ({
      id: s.id, name: s.name, admissionNo: s.admission_no,
      className: s.class_name, gender: s.gender || '',
      email: s.email || '', guardianName: s.guardian_name || '',
      guardianPhone: s.guardian_phone || '',
    })),
  });
});

/* ==================================================================
   ⭐ STUDENT GRADES — quizzes + assignments for every student in
   this teacher's classes, plus their own quiz/assignment summaries
   ================================================================== */
function pctToGrade(pct) {
  if (pct >= 75) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 45) return 'D';
  if (pct >= 40) return 'E';
  return 'F';
}

router.get('/me/grades', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) {
    return res.json({ quizzes: [], assignments: [], students: [], classNames: [] });
  }

  /* ---------- Quizzes created by this teacher ---------- */
  const [quizzes] = await pool.execute(
    `SELECT q.id, q.title, q.subject, q.class_name, q.due_date,
            COUNT(qs.id) AS submissions,
            AVG(CASE WHEN qs.total > 0 THEN (qs.score / qs.total) * 100 END) AS avg_pct
     FROM quizzes q
     LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id
     WHERE q.teacher_id = ?
     GROUP BY q.id
     ORDER BY q.id DESC`,
    [ctx.teacherId]
  );

  /* ---------- Assignments created by this teacher ---------- */
  const [assignments] = await pool.execute(
    `SELECT a.id, a.title, a.subject, a.class_name, a.total_marks, a.due_date,
            COUNT(s.id) AS submissions,
            SUM(CASE WHEN s.score IS NOT NULL THEN 1 ELSE 0 END) AS graded,
            AVG(CASE WHEN s.score IS NOT NULL AND a.total_marks > 0
                     THEN (s.score / a.total_marks) * 100 END) AS avg_pct
     FROM assignments a
     LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
     WHERE a.teacher_id = ?
     GROUP BY a.id
     ORDER BY a.id DESC`,
    [ctx.teacherId]
  );

  /* ---------- Students in this teacher's classes ---------- */
  const classSet = new Set();
  if (ctx.formClass) classSet.add(ctx.formClass);
  ctx.assignments.forEach((a) => classSet.add(a.className));
  const classList = Array.from(classSet).filter(Boolean);

  let students = [];

  if (classList.length) {
    const cPlaceholders = classList.map(() => '?').join(',');
    const [studentRows] = await pool.execute(
      `SELECT id, name, admission_no, class_name
       FROM students
       WHERE class_name IN (${cPlaceholders})
       ORDER BY class_name, name`,
      classList
    );

    const studentIds = studentRows.map((s) => s.id);

    if (studentIds.length) {
      const sPlaceholders = studentIds.map(() => '?').join(',');

      /* All quiz submissions for these students on THIS teacher's quizzes */
      const [quizSubs] = await pool.execute(
        `SELECT qs.student_id, qs.score, qs.total, qs.date,
                q.id AS quiz_id, q.title, q.subject
         FROM quiz_submissions qs
         JOIN quizzes q ON q.id = qs.quiz_id
         WHERE q.teacher_id = ? AND qs.student_id IN (${sPlaceholders})`,
        [ctx.teacherId, ...studentIds]
      );

      /* All assignment submissions for these students on THIS teacher's assignments */
      const [assignSubs] = await pool.execute(
        `SELECT s.student_id, s.score, s.feedback, s.submitted_at, s.graded_at,
                a.id AS assignment_id, a.title, a.subject, a.total_marks
         FROM assignment_submissions s
         JOIN assignments a ON a.id = s.assignment_id
         WHERE a.teacher_id = ? AND s.student_id IN (${sPlaceholders})`,
        [ctx.teacherId, ...studentIds]
      );

      students = studentRows.map((st) => {
        const myQuiz = quizSubs.filter((x) => x.student_id === st.id);
        const myAssign = assignSubs.filter((x) => x.student_id === st.id);

        const quizGrades = myQuiz.map((q) => {
          const pct = q.total ? Math.round((q.score / q.total) * 100) : 0;
          return {
            quizId: q.quiz_id,
            title: q.title,
            subject: q.subject,
            score: q.score,
            total: q.total,
            percentage: pct,
            grade: pctToGrade(pct),
            date: q.date,
          };
        });

        const assignmentGrades = myAssign.map((a) => {
          const graded = a.score !== null && a.score !== undefined;
          const pct =
            graded && a.total_marks
              ? Math.round((a.score / a.total_marks) * 100)
              : null;
          return {
            assignmentId: a.assignment_id,
            title: a.title,
            subject: a.subject,
            score: a.score,
            totalMarks: a.total_marks,
            percentage: pct,
            grade: pct !== null ? pctToGrade(pct) : '—',
            feedback: a.feedback,
            submittedAt: a.submitted_at,
            gradedAt: a.graded_at,
            graded,
          };
        });

        const quizPcts = quizGrades.map((q) => q.percentage);
        const assignPcts = assignmentGrades
          .filter((a) => a.graded)
          .map((a) => a.percentage);
        const allPcts = [...quizPcts, ...assignPcts];

        return {
          id: st.id,
          name: st.name,
          admissionNo: st.admission_no,
          className: st.class_name,
          quizGrades,
          assignmentGrades,
          summary: {
            quizAverage: quizPcts.length
              ? Math.round(quizPcts.reduce((s, x) => s + x, 0) / quizPcts.length)
              : 0,
            assignmentAverage: assignPcts.length
              ? Math.round(assignPcts.reduce((s, x) => s + x, 0) / assignPcts.length)
              : 0,
            overallAverage: allPcts.length
              ? Math.round(allPcts.reduce((s, x) => s + x, 0) / allPcts.length)
              : 0,
            quizzesTaken: quizGrades.length,
            assignmentsSubmitted: assignmentGrades.length,
            assignmentsGraded: assignPcts.length,
          },
        };
      });
    }
  }

  res.json({
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      subject: q.subject,
      className: q.class_name,
      dueDate: q.due_date,
      submissions: Number(q.submissions),
      averageScore: q.avg_pct !== null ? Math.round(q.avg_pct) : 0,
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      className: a.class_name,
      totalMarks: a.total_marks,
      dueDate: a.due_date,
      submissions: Number(a.submissions),
      graded: Number(a.graded),
      averageScore: a.avg_pct !== null ? Math.round(a.avg_pct) : 0,
    })),
    students,
    classNames: classList,
  });
});

/* ---------- ANNOUNCEMENTS ---------- */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM announcements ORDER BY date DESC LIMIT 10'
  );
  res.json(rows);
});

module.exports = router;