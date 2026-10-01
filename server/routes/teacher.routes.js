const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { getTeacherContext, teachablePairs, canTeach } = require('../utils/teacherContext');
const { notify } = require('../utils/notify');

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
    id: t.id, name: t.name, staffNo: t.staff_no, email: t.email,
    phone: t.phone || '', subjects: parseSubjects(t.subjects),
    formClass: t.form_class || '', teacherType: t.teacher_type || 'class_teacher',
    assignments: ctx.assignments, qualification: t.qualification || '',
    address: t.address || '', joined: t.joined, photo: t.photo || null,
  });
});

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

/* ---------- TEACHING TARGETS ---------- */
router.get('/me/assignments', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json([]);
  res.json(teachablePairs(ctx));
});

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
    const classSubjects = ctx.assignments.filter((a) => a.className === cName).map((a) => a.subject);
    result.push({
      id: clsRows[0]?.id, name: cName,
      subjects: classSubjects.length ? classSubjects : ctx.subjects,
      isFormClass: cName === ctx.formClass,
      students: students.map((s) => ({
        id: s.id, name: s.name, admissionNo: s.admission_no, className: s.class_name,
      })),
    });
  }
  res.json(result);
});

router.get('/me/students', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.json({ formClass: null, classNames: [], students: [] });

  const classNames = new Set();
  if (ctx.formClass) classNames.add(ctx.formClass);
  ctx.assignments.forEach((a) => classNames.add(a.className));
  if (!classNames.size) {
    return res.json({ formClass: null, teacherType: ctx.teacherType, classNames: [], students: [] });
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

function pctToGrade(pct) {
  if (pct >= 75) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 45) return 'D';
  if (pct >= 40) return 'E';
  return 'F';
}

/* ==========================================================================
   ⭐ NEW — My Students' Grades  (used by /teacher/grades)
   ========================================================================== */
router.get('/me/grades', async (req, res) => {
  try {
    const ctx = await getTeacherContext(req.user.id);
    if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

    // 1. Every class this teacher touches
    const classSet = new Set();
    if (ctx.formClass) classSet.add(ctx.formClass);
    ctx.assignments.forEach((a) => classSet.add(a.className));
    const classNames = Array.from(classSet);

    if (!classNames.length) {
      return res.json({ students: [], quizzes: [], assignments: [], classNames: [] });
    }

    const classPlaceholders = classNames.map(() => '?').join(',');

    // 2. Students in those classes
    const [students] = await pool.execute(
      `SELECT id, name, class_name, admission_no, gender
       FROM students
       WHERE class_name IN (${classPlaceholders})
       ORDER BY class_name, name`,
      classNames
    );

    // 3. Quizzes owned by this teacher
    const [quizzes] = await pool.execute(
      `SELECT id, title, subject, class_name, due_date
       FROM quizzes WHERE teacher_id = ?`,
      [ctx.teacherId]
    );

    // 4. Submissions for those quizzes
    let quizSubs = [];
    if (quizzes.length) {
      const qph = quizzes.map(() => '?').join(',');
      [quizSubs] = await pool.execute(
        `SELECT id, quiz_id, student_id, score, total, date
         FROM quiz_submissions
         WHERE quiz_id IN (${qph})`,
        quizzes.map((q) => q.id)
      );
    }

    // 5. Assignments owned by this teacher
    const [assignments] = await pool.execute(
      `SELECT id, title, subject, class_name, total_marks, due_date
       FROM assignments WHERE teacher_id = ?`,
      [ctx.teacherId]
    );

    // 6. Submissions for those assignments
    let assignSubs = [];
    if (assignments.length) {
      const aph = assignments.map(() => '?').join(',');
      [assignSubs] = await pool.execute(
        `SELECT id, assignment_id, student_id, score, feedback, submitted_at, graded_at
         FROM assignment_submissions
         WHERE assignment_id IN (${aph})`,
        assignments.map((a) => a.id)
      );
    }

    const quizById = Object.fromEntries(quizzes.map((q) => [q.id, q]));
    const assignById = Object.fromEntries(assignments.map((a) => [a.id, a]));

    // 7. Per-student rows
    const studentRows = students.map((s) => {
      const myQuizSubs = quizSubs.filter((qs) => qs.student_id === s.id);
      const myAssignSubs = assignSubs.filter((as) => as.student_id === s.id);

      const quizGrades = myQuizSubs.map((qs) => {
        const q = quizById[qs.quiz_id];
        const pct = qs.total ? Math.round((qs.score / qs.total) * 100) : 0;
        return {
          title: q?.title || 'Quiz',
          subject: q?.subject || '—',
          score: qs.score,
          total: qs.total,
          percentage: pct,
          grade: pctToGrade(pct),
          date: qs.date,
        };
      });

      const assignmentGrades = myAssignSubs.map((as) => {
        const a = assignById[as.assignment_id];
        const graded = as.score !== null && as.score !== undefined;
        const totalMarks = a?.total_marks || 0;
        const pct = graded && totalMarks
          ? Math.round((as.score / totalMarks) * 100)
          : null;
        return {
          title: a?.title || 'Assignment',
          subject: a?.subject || '—',
          score: as.score,
          totalMarks,
          percentage: pct,
          grade: pct !== null ? pctToGrade(pct) : '—',
          graded,
          feedback: as.feedback || '',
        };
      });

      const gradedAssignments = assignmentGrades.filter((a) => a.graded);
      const quizPcts = quizGrades.map((q) => q.percentage);
      const assignPcts = gradedAssignments.map((a) => a.percentage);
      const allPcts = [...quizPcts, ...assignPcts];

      const avg = (arr) =>
        arr.length ? Math.round(arr.reduce((sum, x) => sum + x, 0) / arr.length) : 0;

      return {
        id: s.id,
        name: s.name,
        className: s.class_name,
        admissionNo: s.admission_no,
        gender: s.gender || '',
        summary: {
          quizAverage: avg(quizPcts),
          assignmentAverage: avg(assignPcts),
          overallAverage: avg(allPcts),
          quizzesTaken: quizGrades.length,
          assignmentsSubmitted: assignmentGrades.length,
          assignmentsGraded: gradedAssignments.length,
        },
        quizGrades,
        assignmentGrades,
      };
    });

    // 8. Quiz list summary
    const quizSummary = quizzes.map((q) => {
      const subs = quizSubs.filter((qs) => qs.quiz_id === q.id);
      const pcts = subs.map((qs) => (qs.total ? (qs.score / qs.total) * 100 : 0));
      const averageScore = pcts.length
        ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length)
        : 0;
      return {
        id: q.id,
        title: q.title,
        subject: q.subject,
        className: q.class_name,
        submissions: subs.length,
        averageScore,
        dueDate: q.due_date,
      };
    });

    // 9. Assignment list summary
    const assignSummary = assignments.map((a) => {
      const subs = assignSubs.filter((as) => as.assignment_id === a.id);
      const graded = subs.filter((as) => as.score !== null && as.score !== undefined);
      const pcts = graded.map((as) =>
        a.total_marks ? (as.score / a.total_marks) * 100 : 0
      );
      const averageScore = pcts.length
        ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length)
        : 0;
      return {
        id: a.id,
        title: a.title,
        subject: a.subject,
        className: a.class_name,
        submissions: subs.length,
        graded: graded.length,
        averageScore,
        dueDate: a.due_date,
      };
    });

    res.json({
      students: studentRows,
      quizzes: quizSummary,
      assignments: assignSummary,
      classNames,
    });
  } catch (err) {
    console.error('Teacher grades failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load grades' });
  }
});

/* ==========================================================================
   GRADEBOOK
   ========================================================================== */
router.get('/me/academic/gradebook', async (req, res) => {
  const { className, subject, session, term } = req.query;
  if (!className || !subject || !session || !term) {
    return res.status(400).json({ message: 'className, subject, session and term are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [rows] = await pool.execute(
    `SELECT s.id, s.name, s.admission_no, r.ca, r.exam
     FROM students s
     LEFT JOIN results r ON r.student_id = s.id
       AND r.session = ? AND r.term = ? AND r.subject = ?
     WHERE s.class_name = ?
     ORDER BY s.name`,
    [session, term, subject, className]
  );

  res.json(rows.map((row) => ({
    studentId: row.id, name: row.name, admissionNo: row.admission_no,
    ca: row.ca, exam: row.exam,
  })));
});

router.put('/me/academic/gradebook', async (req, res) => {
  const { className, subject, session, term, entries } = req.body;
  if (!className || !subject || !session || !term || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ message: 'className, subject, session, term and entries are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const studentIds = entries.map((e) => Number(e.studentId));
  if (studentIds.some((id) => !Number.isInteger(id) || id < 1) || new Set(studentIds).size !== studentIds.length) {
    return res.status(400).json({ message: 'Entries must contain unique valid student IDs' });
  }
  for (const e of entries) {
    const ca = Number(e.ca); const exam = Number(e.exam);
    if (!Number.isInteger(ca) || ca < 0 || ca > 30 || !Number.isInteger(exam) || exam < 0 || exam > 70) {
      return res.status(400).json({ message: 'CA must be 0–30 and exam must be 0–70' });
    }
  }

  const placeholders = studentIds.map(() => '?').join(',');
  const [roster] = await pool.execute(
    `SELECT id FROM students WHERE class_name = ? AND id IN (${placeholders})`,
    [className, ...studentIds]
  );
  if (roster.length !== studentIds.length) {
    return res.status(400).json({ message: 'One or more students are not in this class' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const e of entries) {
      await conn.execute(
        `INSERT INTO results (student_id, session, term, subject, ca, exam)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ca = VALUES(ca), exam = VALUES(exam)`,
        [Number(e.studentId), session, term, subject, Number(e.ca), Number(e.exam)]
      );
    }
    await conn.commit();
    res.json({ message: `Saved grades for ${entries.length} student(s)`, saved: entries.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message || 'Failed to save grades' });
  } finally { conn.release(); }
});

router.get('/me/academic/progress', async (req, res) => {
  const { className, subject } = req.query;
  if (!className || !subject) return res.status(400).json({ message: 'className and subject are required' });
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [rows] = await pool.execute(
    `SELECT r.session, r.term,
            ROUND(AVG(COALESCE(r.ca, 0) + COALESCE(r.exam, 0))) AS average,
            COUNT(DISTINCT r.student_id) AS student_count
     FROM results r
     INNER JOIN students s ON s.id = r.student_id
     WHERE s.class_name = ? AND r.subject = ?
     GROUP BY r.session, r.term
     ORDER BY r.session ASC,
       FIELD(r.term, 'First Term', 'Second Term', 'Third Term'), r.term ASC`,
    [className, subject]
  );

  res.json(rows.map((row) => ({
    session: row.session, term: row.term,
    average: Number(row.average || 0),
    studentCount: Number(row.student_count || 0),
  })));
});

/* ==========================================================================
   QUESTION BANK — enhanced with source filters, edit, reuse
   ========================================================================== */

/* GET /me/academic/questions
   Query: className?, subject?, source?, q?
   Without className/subject → returns the teacher's full bank.
*/
router.get('/me/academic/questions', async (req, res) => {
  const { className, subject, source, q } = req.query;

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const where = ['teacher_id = ?'];
  const values = [ctx.teacherId];

  if (className) { where.push('class_name = ?'); values.push(className); }
  if (subject) { where.push('subject = ?'); values.push(subject); }
  if (source && source !== 'all') { where.push('source_type = ?'); values.push(source); }
  if (q) {
    where.push('(question LIKE ? OR options LIKE ?)');
    values.push(`%${q}%`, `%${q}%`);
  }

  const [rows] = await pool.execute(
    `SELECT id, class_name, subject, question, options, answer,
            source_type, source_id, source_name, usage_count, last_used_at, created_at
     FROM question_bank
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(last_used_at, created_at) DESC, id DESC
     LIMIT 500`,
    values
  );

  res.json(rows.map((row) => ({
    id: row.id,
    className: row.class_name,
    subject: row.subject,
    question: row.question,
    options: JSON.parse(row.options || '[]'),
    answer: row.answer,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceName: row.source_name,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  })));
});

/* POST /me/academic/questions — add a manual question */
router.post('/me/academic/questions', async (req, res) => {
  const { className, subject, question, options, answer } = req.body;
  if (!className || !subject || !String(question || '').trim() ||
      !Array.isArray(options) || options.length < 2 || options.length > 4) {
    return res.status(400).json({ message: 'Class, subject, question and 2–4 options are required' });
  }
  const normalizedOptions = options.map((o) => String(o || '').trim());
  const answerIndex = Number(answer);
  if (normalizedOptions.some((o) => !o) || !Number.isInteger(answerIndex) ||
      answerIndex < 0 || answerIndex >= options.length) {
    return res.status(400).json({ message: 'Enter each option and select a valid correct answer' });
  }

  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [result] = await pool.execute(
    `INSERT INTO question_bank
       (teacher_id, class_name, subject, question, options, answer, source_type)
     VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
    [ctx.teacherId, className, subject, String(question).trim(),
      JSON.stringify(normalizedOptions), answerIndex]
  );

  res.status(201).json({
    id: result.insertId, className, subject,
    question: String(question).trim(),
    options: normalizedOptions, answer: answerIndex,
    sourceType: 'manual',
  });
});

/* PATCH /me/academic/questions/:id — edit a saved question */
router.patch('/me/academic/questions/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM question_bank WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Question not found' });

  const { question, options, answer, className, subject } = req.body;

  const updates = [];
  const values = [];

  if (question !== undefined) {
    if (!String(question).trim()) return res.status(400).json({ message: 'Question text cannot be empty' });
    updates.push('question = ?'); values.push(String(question).trim());
  }
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'At least 2 options are required' });
    }
    const normalized = options.map((o) => String(o || '').trim());
    if (normalized.some((o) => !o)) {
      return res.status(400).json({ message: 'Options cannot be empty' });
    }
    updates.push('options = ?'); values.push(JSON.stringify(normalized));
  }
  if (answer !== undefined) {
    const a = Number(answer);
    if (!Number.isInteger(a) || a < 0) {
      return res.status(400).json({ message: 'Invalid answer index' });
    }
    updates.push('answer = ?'); values.push(a);
  }
  if (className !== undefined) { updates.push('class_name = ?'); values.push(className); }
  if (subject !== undefined)    { updates.push('subject = ?');    values.push(subject); }

  if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });

  values.push(req.params.id, ctx.teacherId);
  await pool.execute(
    `UPDATE question_bank SET ${updates.join(', ')} WHERE id = ? AND teacher_id = ?`,
    values
  );

  const [updated] = await pool.execute('SELECT * FROM question_bank WHERE id = ?', [req.params.id]);
  const row = updated[0];
  res.json({
    message: 'Question updated',
    question: {
      id: row.id, className: row.class_name, subject: row.subject,
      question: row.question, options: JSON.parse(row.options || '[]'),
      answer: row.answer,
      sourceType: row.source_type, sourceName: row.source_name,
      usageCount: row.usage_count, lastUsedAt: row.last_used_at,
    },
  });
});

/* POST /me/academic/questions/:id/reuse — mark as reused */
router.post('/me/academic/questions/:id/reuse', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    `UPDATE question_bank
     SET usage_count = usage_count + 1, last_used_at = NOW()
     WHERE id = ? AND teacher_id = ?`,
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Question not found' });
  res.json({ message: 'Marked as used' });
});

/* DELETE /me/academic/questions/:id */
router.delete('/me/academic/questions/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    'DELETE FROM question_bank WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Question not found' });
  res.json({ message: 'Question removed from the bank' });
});

/* ==========================================================================
   ASSIGNMENT TEMPLATES
   ========================================================================== */

router.get('/me/academic/assignment-templates', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const { subject, q } = req.query;
  const where = ['teacher_id = ?'];
  const values = [ctx.teacherId];

  if (subject) { where.push('subject = ?'); values.push(subject); }
  if (q) {
    where.push('(title LIKE ? OR description LIKE ?)');
    values.push(`%${q}%`, `%${q}%`);
  }

  const [rows] = await pool.execute(
    `SELECT id, teacher_id, title, subject, class_name, description, total_marks,
            source_id, usage_count, last_used_at, created_at
     FROM assignment_templates
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(last_used_at, created_at) DESC, id DESC
     LIMIT 300`,
    values
  );

  res.json(rows.map((r) => ({
    id: r.id,
    title: r.title,
    subject: r.subject,
    className: r.class_name,
    description: r.description,
    totalMarks: r.total_marks,
    sourceId: r.source_id,
    usageCount: r.usage_count,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    fromAssignment: !!r.source_id,
  })));
});

router.post('/me/academic/assignment-templates', async (req, res) => {
  const { title, subject, className, description, totalMarks } = req.body;
  if (!title || !subject || !className) {
    return res.status(400).json({ message: 'title, subject and className are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    `INSERT INTO assignment_templates
      (teacher_id, title, subject, class_name, description, total_marks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ctx.teacherId, String(title).trim(), subject, className,
      String(description || '').trim(), Number(totalMarks) || 10]
  );

  const [rows] = await pool.execute('SELECT * FROM assignment_templates WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Template saved', template: rows[0] });
});

router.patch('/me/academic/assignment-templates/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    'SELECT id FROM assignment_templates WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Template not found' });

  const map = {
    title: 'title', subject: 'subject', className: 'class_name',
    description: 'description', totalMarks: 'total_marks',
  };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });

  values.push(req.params.id, ctx.teacherId);
  await pool.execute(
    `UPDATE assignment_templates SET ${updates.join(', ')} WHERE id = ? AND teacher_id = ?`,
    values
  );
  const [updated] = await pool.execute('SELECT * FROM assignment_templates WHERE id = ?', [req.params.id]);
  res.json({ message: 'Template updated', template: updated[0] });
});

router.post('/me/academic/assignment-templates/:id/reuse', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    `UPDATE assignment_templates
     SET usage_count = usage_count + 1, last_used_at = NOW()
     WHERE id = ? AND teacher_id = ?`,
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Template not found' });
  res.json({ message: 'Marked as used' });
});

router.delete('/me/academic/assignment-templates/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    'DELETE FROM assignment_templates WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Template not found' });
  res.json({ message: 'Template deleted' });
});

/* ==========================================================================
   LESSON PLANS
   ========================================================================== */
router.get('/me/academic/lessons', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    `SELECT id, class_name, subject, title,
            DATE_FORMAT(lesson_date, '%Y-%m-%d') AS lesson_date,
            objectives, activities, resources, created_at
     FROM lesson_plans WHERE teacher_id = ?
     ORDER BY lesson_date DESC, id DESC`,
    [ctx.teacherId]
  );
  res.json(rows);
});

router.post('/me/academic/lessons', async (req, res) => {
  const { className, subject, title, lessonDate, objectives, activities, resources } = req.body;
  if (!className || !subject || !String(title || '').trim() || !lessonDate || !String(objectives || '').trim()) {
    return res.status(400).json({ message: 'Class, subject, title, date and objectives are required' });
  }
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  if (!canTeach(ctx, className, subject)) {
    return res.status(403).json({ message: 'You are not assigned to this class and subject' });
  }

  const [result] = await pool.execute(
    `INSERT INTO lesson_plans
       (teacher_id, class_name, subject, title, lesson_date, objectives, activities, resources)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ctx.teacherId, className, subject, String(title).trim(), lessonDate,
      String(objectives).trim(), activities || '', resources || '']
  );
  res.status(201).json({ id: result.insertId, message: 'Lesson plan saved' });
});

router.delete('/me/academic/lessons/:id', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [result] = await pool.execute(
    'DELETE FROM lesson_plans WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Lesson plan not found' });
  res.json({ message: 'Lesson plan deleted' });
});

/* ==========================================================================
   MEETINGS
   ========================================================================== */
router.get('/me/meetings', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });

  const [rows] = await pool.execute(
    `SELECT m.*,
            p.name AS parent_name, p.email AS parent_email, p.phone AS parent_phone,
            p.relationship AS parent_relationship,
            s.name AS student_name, s.class_name AS student_class,
            s.admission_no AS student_admission
     FROM meetings m
     JOIN parents p ON p.id = m.parent_id
     JOIN students s ON s.id = m.student_id
     WHERE m.teacher_id = ?
     ORDER BY m.created_at DESC`,
    [ctx.teacherId]
  );

  res.json(rows.map((m) => ({
    id: m.id, topic: m.topic, message: m.message,
    preferredDate: m.preferred_date, preferredTime: m.preferred_time,
    durationMinutes: m.duration_minutes, status: m.status,
    scheduledDate: m.scheduled_date, scheduledTime: m.scheduled_time,
    teacherResponse: m.teacher_response, completedNotes: m.completed_notes,
    createdAt: m.created_at, updatedAt: m.updated_at,
    parent: { id: m.parent_id, name: m.parent_name, email: m.parent_email,
              phone: m.parent_phone, relationship: m.parent_relationship },
    student: { id: m.student_id, name: m.student_name,
               className: m.student_class, admissionNo: m.student_admission },
  })));
});

async function getOwnMeeting(req, res, ctx) {
  const [rows] = await pool.execute(
    'SELECT * FROM meetings WHERE id = ? AND teacher_id = ?',
    [req.params.id, ctx.teacherId]
  );
  if (!rows.length) { res.status(404).json({ message: 'Meeting not found' }); return null; }
  return rows[0];
}

async function notifyParent(meeting, title, body) {
  try {
    const [pRows] = await pool.execute(
      'SELECT user_id FROM parents WHERE id = ?', [meeting.parent_id]
    );
    if (pRows.length && pRows[0].user_id) {
      await notify({ userId: pRows[0].user_id, type: 'meeting', title, body, link: '/parent/meetings' });
    }
  } catch (e) { console.error('Notify parent failed:', e.message); }
}

router.patch('/me/meetings/:id/accept', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  const m = await getOwnMeeting(req, res, ctx);
  if (!m) return;
  if (['completed', 'cancelled', 'declined'].includes(m.status)) {
    return res.status(400).json({ message: `Cannot accept a ${m.status} meeting` });
  }

  const scheduledDate = req.body.scheduledDate || m.preferred_date;
  const scheduledTime = req.body.scheduledTime || m.preferred_time;

  await pool.execute(
    `UPDATE meetings SET status = 'accepted', scheduled_date = ?, scheduled_time = ?,
       teacher_response = ? WHERE id = ?`,
    [scheduledDate, scheduledTime, req.body.teacherResponse || '', m.id]
  );
  await notifyParent(m, 'Meeting accepted',
    `Your meeting "${m.topic}" is confirmed for ${scheduledDate} at ${scheduledTime}`);
  res.json({ message: 'Meeting accepted' });
});

router.patch('/me/meetings/:id/decline', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  const m = await getOwnMeeting(req, res, ctx);
  if (!m) return;

  await pool.execute(
    `UPDATE meetings SET status = 'declined', teacher_response = ? WHERE id = ?`,
    [req.body.teacherResponse || 'Unable to attend at this time.', m.id]
  );
  await notifyParent(m, 'Meeting declined', `Your meeting request "${m.topic}" was declined`);
  res.json({ message: 'Meeting declined' });
});

router.patch('/me/meetings/:id/reschedule', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  const m = await getOwnMeeting(req, res, ctx);
  if (!m) return;

  const { scheduledDate, scheduledTime, teacherResponse } = req.body;
  if (!scheduledDate || !scheduledTime) {
    return res.status(400).json({ message: 'New date and time are required' });
  }

  await pool.execute(
    `UPDATE meetings SET status = 'rescheduled', scheduled_date = ?, scheduled_time = ?,
       teacher_response = ? WHERE id = ?`,
    [scheduledDate, scheduledTime, teacherResponse || '', m.id]
  );
  await notifyParent(m, 'Meeting rescheduled',
    `"${m.topic}" was moved to ${scheduledDate} at ${scheduledTime}`);
  res.json({ message: 'Meeting rescheduled' });
});

router.patch('/me/meetings/:id/complete', async (req, res) => {
  const ctx = await getTeacherContext(req.user.id);
  if (!ctx) return res.status(404).json({ message: 'Teacher not found' });
  const m = await getOwnMeeting(req, res, ctx);
  if (!m) return;

  await pool.execute(
    `UPDATE meetings SET status = 'completed', completed_notes = ? WHERE id = ?`,
    [req.body.completedNotes || '', m.id]
  );
  await notifyParent(m, 'Meeting completed', `Notes are now available for "${m.topic}"`);
  res.json({ message: 'Meeting marked complete' });
});

/* ---------- ANNOUNCEMENTS ---------- */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM announcements ORDER BY date DESC LIMIT 10'
  );
  res.json(rows);
});

module.exports = router;