const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');

router.use(protect, allow('student'));

/* ---------- PROFILE ---------- */
router.get('/me', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Student not found' });
  const s = rows[0];
  res.json({
    id: s.id, name: s.name, admissionNo: s.admission_no,
    className: s.class_name, gender: s.gender, dob: s.dob,
    guardianName: s.guardian_name, guardianPhone: s.guardian_phone,
    address: s.address, email: s.email, house: s.house,
    photo: s.photo || null,
  });
});

/* ---------- UPDATE OWN PROFILE ---------- */
router.patch('/me', async (req, res) => {
  const [existing] = await pool.execute(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!existing.length) return res.status(404).json({ message: 'Student not found' });

  const map = {
    name: 'name', gender: 'gender', dob: 'dob', email: 'email',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone', address: 'address',
  };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (updates.length) {
    values.push(req.user.id);
    await pool.execute(`UPDATE students SET ${updates.join(', ')} WHERE user_id = ?`, values);
  }

  // Sync shared users table
  const userUpdates = [], userValues = [];
  if (req.body.name !== undefined)  { userUpdates.push('name = ?');  userValues.push(req.body.name); }
  if (req.body.email !== undefined) { userUpdates.push('email = ?'); userValues.push(String(req.body.email).toLowerCase()); }
  if (userUpdates.length) {
    userValues.push(req.user.id);
    await pool.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
  }

  const [rows] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
  const s = rows[0];
  res.json({
    message: 'Profile updated',
    student: {
      id: s.id, name: s.name, admissionNo: s.admission_no,
      className: s.class_name, gender: s.gender, dob: s.dob,
      guardianName: s.guardian_name, guardianPhone: s.guardian_phone,
      address: s.address, email: s.email, house: s.house,
      photo: s.photo || null,
    },
  });
});

/* ---------- CLASSES ---------- */
router.get('/me/classes', async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT id, class_name FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) {
    return res.json({ className: null, subjects: [], schedule: [], classmates: [] });
  }
  const className = studentRows[0].class_name;
  const myStudentId = studentRows[0].id;

  const [classRows] = await pool.execute('SELECT * FROM classes WHERE name = ?', [className]);
  if (!classRows.length) {
    return res.json({ className, subjects: [], schedule: [], classmates: [] });
  }
  const myClass = classRows[0];

  /* ⭐ Exclude the logged-in student from the classmates list */
  const [classmates] = await pool.execute(
    `SELECT id, name, admission_no
     FROM students
     WHERE class_name = ? AND id != ?
     ORDER BY name`,
    [className, myStudentId]
  );

  res.json({
    id: myClass.id,
    name: myClass.name,
    subjects: JSON.parse(myClass.subjects || '[]'),
    schedule: JSON.parse(myClass.schedule || '[]'),
    classmates: classmates.map((c) => ({
      id: c.id, name: c.name, admissionNo: c.admission_no,
    })),
  });
});

/* ---------- RESULTS (with session / term filter) ---------- */
/* ---------- RESULTS (with session / term filter) ---------- */
router.get('/me/results', async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT id, name, class_name FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) {
    return res.json({
      studentId: null,
      sessions: [], terms: [],
      current: { session: '', term: '' },
      subjects: [], average: 0, overallGrade: 'F',
    });
  }
  const studentId = studentRows[0].id;

  const [combos] = await pool.execute(
    `SELECT DISTINCT session, term FROM results
     WHERE student_id = ?
     ORDER BY session DESC, term ASC`,
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
    `SELECT * FROM results
     WHERE student_id = ? AND session = ? AND term = ?
     ORDER BY subject`,
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

  res.json({
    // ⭐ NEW: identity for print URLs
    studentId,
    studentName: studentRows[0].name,
    studentClass: studentRows[0].class_name,
    // existing fields
    sessions: [...new Set(combos.map((c) => c.session))],
    terms: ['First Term', 'Second Term', 'Third Term'],
    current: { session: session || '', term: term || '' },
    subjects: formatted,
    average,
    overallGrade: gradeFor(average).grade,
  });
});

/* ==========================================================================
   FEES — full overview
   ========================================================================== */
router.get('/me/fees', async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) return res.json([]);

  const [rows] = await pool.execute(
    'SELECT * FROM fees WHERE student_id = ? ORDER BY date DESC',
    [studentRows[0].id]
  );

  res.json(
    rows.map((f) => {
      const items = JSON.parse(f.items || '[]');
      const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
      const paid = parseFloat(f.amount_paid);
      const balance = Math.max(total - paid, 0);
      const status = balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
      return {
        id: f.id,
        session: f.session,
        term: f.term,
        items,
        total,
        amountPaid: paid,
        balance,
        status,
        date: f.date,
        reference: f.reference,
        method: f.method,
      };
    })
  );
});

/* ---------- FEES — pay (simulated) ---------- */
router.post('/me/fees/:id/pay', async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) return res.status(404).json({ message: 'Student not found' });

  const [feeRows] = await pool.execute(
    'SELECT * FROM fees WHERE id = ? AND student_id = ?',
    [req.params.id, studentRows[0].id]
  );
  if (!feeRows.length) return res.status(404).json({ message: 'Fee record not found' });
  const fee = feeRows[0];

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }

  const items = JSON.parse(fee.items || '[]');
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const currentlyPaid = parseFloat(fee.amount_paid);
  const balance = total - currentlyPaid;

  if (balance <= 0) {
    return res.status(400).json({ message: 'This term is fully paid' });
  }
  if (amount > balance) {
    return res.status(400).json({
      message: `Amount exceeds outstanding balance (₦${balance.toLocaleString()})`,
    });
  }

  const newPaid = currentlyPaid + amount;
  const method = req.body.method || 'Card';

  await pool.execute(
    'UPDATE fees SET amount_paid = ?, method = ?, date = CURDATE() WHERE id = ?',
    [newPaid, method, fee.id]
  );

  const [updated] = await pool.execute('SELECT * FROM fees WHERE id = ?', [fee.id]);
  const u = updated[0];
  const newItems = JSON.parse(u.items || '[]');
  const newTotal = newItems.reduce((sum, i) => sum + Number(i.amount), 0);
  const newBalance = newTotal - parseFloat(u.amount_paid);

  res.json({
    message: 'Payment successful',
    fee: {
      id: u.id,
      session: u.session,
      term: u.term,
      items: newItems,
      total: newTotal,
      amountPaid: parseFloat(u.amount_paid),
      balance: Math.max(newBalance, 0),
      status: newBalance <= 0 ? 'Paid' : 'Partial',
      date: u.date,
      reference: u.reference,
      method: u.method,
    },
  });
});

/* ---------- FEES — receipt data ---------- */
router.get('/me/fees/:id/receipt', async (req, res) => {
  const [studentRows] = await pool.execute(
    'SELECT * FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) return res.status(404).json({ message: 'Student not found' });
  const student = studentRows[0];

  const [feeRows] = await pool.execute(
    'SELECT * FROM fees WHERE id = ? AND student_id = ?',
    [req.params.id, student.id]
  );
  if (!feeRows.length) return res.status(404).json({ message: 'Fee record not found' });
  const fee = feeRows[0];

  const items = JSON.parse(fee.items || '[]');
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const paid = parseFloat(fee.amount_paid);
  const balance = Math.max(total - paid, 0);

  res.json({
    receiptNo: `RCPT-${fee.reference}`,
    invoiceNo: `INV-${fee.reference}`,
    issuedAt: new Date().toISOString(),
    paidOn: fee.date,

    school: {
      name: 'Bright Future Secondary School',
      address: '12 Learning Road, Ikeja, Lagos, Nigeria',
      phone: '+234 800 000 0000',
      email: 'office@brightfuture.edu.ng',
      motto: 'Knowledge · Character · Service',
    },

    student: {
      name: student.name,
      admissionNo: student.admission_no,
      className: student.class_name,
      house: student.house,
      guardianName: student.guardian_name,
      guardianPhone: student.guardian_phone,
    },

    session: fee.session,
    term: fee.term,
    items,
    total,
    amountPaid: paid,
    balance,
    method: fee.method,
    status: balance <= 0 ? 'PAID IN FULL' : 'PART PAYMENT',
  });
});

/* ==================================================================
   ⭐ MY GRADES — every quiz and assignment score in one place
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
  const [studentRows] = await pool.execute(
    'SELECT id FROM students WHERE user_id = ?',
    [req.user.id]
  );
  if (!studentRows.length) {
    return res.json({
      quizGrades: [],
      assignmentGrades: [],
      summary: {
        quizAverage: 0,
        assignmentAverage: 0,
        overallAverage: 0,
        quizCount: 0,
        assignmentCount: 0,
        assignmentsGraded: 0,
        totalGraded: 0,
      },
    });
  }
  const studentId = studentRows[0].id;

  /* ---------- Quiz grades ---------- */
  const [quizRows] = await pool.execute(
    `SELECT qs.id, qs.quiz_id, qs.score, qs.total, qs.date,
            q.title, q.subject, q.class_name,
            t.name AS teacher_name
     FROM quiz_submissions qs
     JOIN quizzes q ON q.id = qs.quiz_id
     LEFT JOIN teachers t ON t.id = q.teacher_id
     WHERE qs.student_id = ?
     ORDER BY qs.date DESC, qs.id DESC`,
    [studentId]
  );

  /* ---------- Assignment grades ---------- */
  const [assignRows] = await pool.execute(
    `SELECT s.id, s.assignment_id, s.score, s.feedback,
            s.submitted_at, s.graded_at,
            a.title, a.subject, a.class_name, a.total_marks,
            t.name AS teacher_name
     FROM assignment_submissions s
     JOIN assignments a ON a.id = s.assignment_id
     LEFT JOIN teachers t ON t.id = a.teacher_id
     WHERE s.student_id = ?
     ORDER BY s.submitted_at DESC`,
    [studentId]
  );

  const quizGrades = quizRows.map((q) => {
    const pct = q.total ? Math.round((q.score / q.total) * 100) : 0;
    return {
      id: q.id,
      quizId: q.quiz_id,
      title: q.title,
      subject: q.subject,
      className: q.class_name,
      teacherName: q.teacher_name || '—',
      score: q.score,
      total: q.total,
      percentage: pct,
      grade: pctToGrade(pct),
      date: q.date,
    };
  });

  const assignmentGrades = assignRows.map((a) => {
    const graded = a.score !== null && a.score !== undefined;
    const pct =
      graded && a.total_marks
        ? Math.round((a.score / a.total_marks) * 100)
        : null;
    return {
      id: a.id,
      assignmentId: a.assignment_id,
      title: a.title,
      subject: a.subject,
      className: a.class_name,
      teacherName: a.teacher_name || '—',
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

  const gradedAssignments = assignmentGrades.filter((a) => a.graded);
  const quizPcts = quizGrades.map((q) => q.percentage);
  const assignPcts = gradedAssignments.map((a) => a.percentage);
  const allPcts = [...quizPcts, ...assignPcts];

  const quizAverage = quizPcts.length
    ? Math.round(quizPcts.reduce((s, x) => s + x, 0) / quizPcts.length)
    : 0;
  const assignmentAverage = assignPcts.length
    ? Math.round(assignPcts.reduce((s, x) => s + x, 0) / assignPcts.length)
    : 0;
  const overallAverage = allPcts.length
    ? Math.round(allPcts.reduce((s, x) => s + x, 0) / allPcts.length)
    : 0;

  res.json({
    quizGrades,
    assignmentGrades,
    summary: {
      quizAverage,
      assignmentAverage,
      overallAverage,
      quizCount: quizGrades.length,
      assignmentCount: assignmentGrades.length,
      assignmentsGraded: gradedAssignments.length,
      totalGraded: allPcts.length,
      overallGrade: pctToGrade(overallAverage),
    },
  });
});

/* ---------- ANNOUNCEMENTS ---------- */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC');
  res.json(rows);
});

module.exports = router;