const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');
const { notify } = require('../utils/notify');

router.use(protect, allow('parent'));

/* ------------------------------------------------------------------
   Context helper — parent + ALL their children
------------------------------------------------------------------ */
async function getParentContext(userId) {
  const [parentRows] = await pool.execute(
    'SELECT * FROM parents WHERE user_id = ?',
    [userId]
  );
  if (!parentRows.length) return { parent: null, children: [] };

  const parent = parentRows[0];
  const [children] = await pool.execute(
    `SELECT * FROM students WHERE parent_id = ? ORDER BY name`,
    [parent.id]
  );

  return { parent, children };
}

function pickChild(children, childId) {
  if (!childId) return children[0] || null;
  return children.find((c) => c.id === Number(childId)) || null;
}

function childPayload(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    admissionNo: c.admission_no,
    className: c.class_name,
    gender: c.gender,
    house: c.house,
    email: c.email,
    photo: c.photo,
  };
}

/* ==================================================================
   PROFILE + CHILDREN LIST
================================================================== */

/* GET /api/parents/me — parent + all children */
router.get('/me', async (req, res) => {
  const { parent, children } = await getParentContext(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  res.json({
    parent: {
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      relationship: parent.relationship,
      address: parent.address,
      photo: parent.photo,
    },
    children: children.map(childPayload),
  });
});

/* GET /api/parents/me/children — just the list */
router.get('/me/children', async (req, res) => {
  const { children } = await getParentContext(req.user.id);
  res.json(children.map(childPayload));
});

/* ==================================================================
   PATCH /api/parents/me — update parent profile
================================================================== */
router.patch('/me', async (req, res) => {
  const { parent } = await getParentContext(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  const map = {
    name: 'name', email: 'email', phone: 'phone',
    relationship: 'relationship', address: 'address',
  };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (updates.length) {
    values.push(req.user.id);
    await pool.execute(`UPDATE parents SET ${updates.join(', ')} WHERE user_id = ?`, values);
  }

  const userUpdates = [], userValues = [];
  if (req.body.name !== undefined)  { userUpdates.push('name = ?');  userValues.push(req.body.name); }
  if (req.body.email !== undefined) { userUpdates.push('email = ?'); userValues.push(String(req.body.email).toLowerCase()); }
  if (userUpdates.length) {
    userValues.push(req.user.id);
    await pool.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
  }

  const [rows] = await pool.execute('SELECT * FROM parents WHERE user_id = ?', [req.user.id]);
  const p = rows[0];
  res.json({
    message: 'Profile updated',
    parent: {
      id: p.id, name: p.name, email: p.email, phone: p.phone,
      relationship: p.relationship, address: p.address, photo: p.photo,
    },
  });
});

/* ==================================================================
   PER-CHILD HELPERS
   Verifies the child actually belongs to this parent
================================================================== */
async function requireChild(req, res, childId) {
  const { parent, children } = await getParentContext(req.user.id);
  if (!parent) { res.status(404).json({ message: 'Parent not found' }); return null; }
  const child = pickChild(children, childId);
  if (!child) { res.status(404).json({ message: 'Child not found' }); return null; }
  return { parent, child, children };
}

/* ==================================================================
   RESULTS
================================================================== */
router.get('/me/children/:childId/results', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [combos] = await pool.execute(
    `SELECT DISTINCT session, term FROM results
     WHERE student_id = ? ORDER BY session DESC, term ASC`,
    [child.id]
  );

  let session = req.query.session;
  let term = req.query.term;
  if (!session || !term) {
    if (combos.length) { session = combos[0].session; term = combos[0].term; }
  }

  const [rows] = await pool.execute(
    `SELECT * FROM results
     WHERE student_id = ? AND session = ? AND term = ?
     ORDER BY subject`,
    [child.id, session, term]
  );

  const subjects = rows.map((r) => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    return { id: r.id, subject: r.subject, ca: r.ca, exam: r.exam, total, grade, remark };
  });

  const average = subjects.length
    ? Math.round(subjects.reduce((s, r) => s + r.total, 0) / subjects.length)
    : 0;

  res.json({
    child: { id: child.id, name: child.name, className: child.class_name, admissionNo: child.admission_no },
    sessions: [...new Set(combos.map((c) => c.session))],
    terms: ['First Term', 'Second Term', 'Third Term'],
    current: { session: session || '', term: term || '' },
    subjects,
    average,
    overallGrade: gradeFor(average).grade,
  });
});

/* ==================================================================
   ATTENDANCE
================================================================== */
router.get('/me/children/:childId/attendance', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [records] = await pool.execute(
    `SELECT date, status, note FROM attendance
     WHERE student_id = ? ORDER BY date DESC LIMIT 60`,
    [child.id]
  );

  const [[summary]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN status = 'Absent'  THEN 1 ELSE 0 END) AS absent,
       SUM(CASE WHEN status = 'Late'    THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) AS excused,
       COUNT(*) AS total
     FROM attendance WHERE student_id = ?`,
    [child.id]
  );

  const total = Number(summary.total || 0);
  const present = Number(summary.present || 0);

  res.json({
    child: { id: child.id, name: child.name, className: child.class_name },
    records,
    summary: {
      present,
      absent: Number(summary.absent || 0),
      late: Number(summary.late || 0),
      excused: Number(summary.excused || 0),
      total,
      percentage: total ? Math.round((present / total) * 100) : 0,
    },
  });
});

/* ==================================================================
   TIMETABLE
================================================================== */
router.get('/me/children/:childId/timetable', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [rows] = await pool.execute(
    `SELECT t.*, te.name AS teacher_name
     FROM timetables t
     LEFT JOIN teachers te ON te.id = t.teacher_id
     WHERE t.class_name = ?
     ORDER BY FIELD(t.day,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), t.period`,
    [child.class_name]
  );

  res.json({
    className: child.class_name,
    slots: rows.map((r) => ({
      id: r.id, day: r.day, period: r.period,
      startTime: r.start_time, endTime: r.end_time,
      subject: r.subject, teacherName: r.teacher_name || '—',
    })),
  });
});

/* ==================================================================
   FEES — current outstanding
================================================================== */
router.get('/me/children/:childId/fees', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [rows] = await pool.execute(
    'SELECT * FROM fees WHERE student_id = ? ORDER BY date DESC',
    [child.id]
  );

  res.json(rows.map((f) => {
    const items = JSON.parse(f.items || '[]');
    const total = items.reduce((s, i) => s + Number(i.amount), 0);
    const paid = parseFloat(f.amount_paid);
    const balance = Math.max(total - paid, 0);
    return {
      id: f.id, session: f.session, term: f.term, items, total,
      amountPaid: paid, balance,
      status: balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
      date: f.date, reference: f.reference, method: f.method,
    };
  }));
});

/* GET /api/parents/me/children/:childId/payments — full history */
router.get('/me/children/:childId/payments', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [rows] = await pool.execute(
    `SELECT * FROM fees WHERE student_id = ? ORDER BY date DESC, id DESC`,
    [child.id]
  );

  const payments = rows.map((f) => {
    const items = JSON.parse(f.items || '[]');
    const total = items.reduce((s, i) => s + Number(i.amount), 0);
    const paid = parseFloat(f.amount_paid);
    const balance = Math.max(total - paid, 0);
    return {
      id: f.id,
      session: f.session,
      term: f.term,
      reference: f.reference,
      amountPaid: paid,
      total,
      balance,
      method: f.method || '—',
      date: f.date,
      status: balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
    };
  });

  // Totals across everything
  const totalBilled = payments.reduce((s, p) => s + p.total, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);

  res.json({
    child: { id: child.id, name: child.name, className: child.class_name, admissionNo: child.admission_no },
    summary: {
      totalBilled,
      totalPaid,
      outstanding: Math.max(totalBilled - totalPaid, 0),
      paymentCount: payments.filter((p) => p.amountPaid > 0).length,
    },
    payments,
  });
});

/* POST /api/parents/me/children/:childId/fees/:id/pay */
router.post('/me/children/:childId/fees/:id/pay', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [feeRows] = await pool.execute(
    'SELECT * FROM fees WHERE id = ? AND student_id = ?',
    [req.params.id, child.id]
  );
  if (!feeRows.length) return res.status(404).json({ message: 'Fee record not found' });
  const fee = feeRows[0];

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }

  const items = JSON.parse(fee.items || '[]');
  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  const currentlyPaid = parseFloat(fee.amount_paid);
  const balance = total - currentlyPaid;

  if (balance <= 0) return res.status(400).json({ message: 'This term is fully paid' });
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
  const newTotal = newItems.reduce((s, i) => s + Number(i.amount), 0);
  const newBalance = newTotal - parseFloat(u.amount_paid);

  res.json({
    message: 'Payment successful',
    fee: {
      id: u.id, session: u.session, term: u.term, items: newItems,
      total: newTotal,
      amountPaid: parseFloat(u.amount_paid),
      balance: Math.max(newBalance, 0),
      status: newBalance <= 0 ? 'Paid' : 'Partial',
      date: u.date, reference: u.reference, method: u.method,
    },
  });
});

/* GET receipt */
router.get('/me/children/:childId/fees/:id/receipt', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [feeRows] = await pool.execute(
    'SELECT * FROM fees WHERE id = ? AND student_id = ?',
    [req.params.id, child.id]
  );
  if (!feeRows.length) return res.status(404).json({ message: 'Fee record not found' });
  const fee = feeRows[0];

  const items = JSON.parse(fee.items || '[]');
  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  const paid = parseFloat(fee.amount_paid);
  const balance = Math.max(total - paid, 0);

  res.json({
    receiptNo: `RCPT-${fee.reference}`,
    invoiceNo: `INV-${fee.reference}`,
    paidOn: fee.date,
    school: {
      name: 'Bright Future Secondary School',
      address: '12 Learning Road, Ikeja, Lagos, Nigeria',
      phone: '+234 800 000 0000',
      email: 'office@brightfuture.edu.ng',
      motto: 'Knowledge · Character · Service',
    },
    student: {
      name: child.name,
      admissionNo: child.admission_no,
      className: child.class_name,
      house: child.house,
      guardianName: child.guardian_name,
      guardianPhone: child.guardian_phone,
    },
    session: fee.session, term: fee.term,
    items, total,
    amountPaid: paid, balance,
    method: fee.method,
    status: balance <= 0 ? 'PAID IN FULL' : 'PART PAYMENT',
  });
});

/* ==================================================================
   BEHAVIOUR
================================================================== */
router.get('/me/children/:childId/behaviour', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  const [rows] = await pool.execute(
    `SELECT br.*, t.name AS teacher_name
     FROM behaviour_reports br
     LEFT JOIN teachers t ON t.id = br.teacher_id
     WHERE br.student_id = ?
     ORDER BY br.date DESC, br.id DESC`,
    [child.id]
  );

  const positive = rows.filter((r) => r.type === 'positive').length;
  const negative = rows.filter((r) => r.type === 'negative').length;

  res.json({
    child: { id: child.id, name: child.name, className: child.class_name, admissionNo: child.admission_no },
    summary: { total: rows.length, positive, negative },
    reports: rows.map((r) => ({
      id: r.id, type: r.type, title: r.title, note: r.note,
      date: r.date, teacherName: r.teacher_name || 'Teacher',
      createdAt: r.created_at,
    })),
  });
});

/* ==================================================================
   ANNOUNCEMENTS
================================================================== */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC');
  res.json(rows);
});

/* ==================================================================
   MEETING REQUESTS — parent side
================================================================== */

/* List teachers available for a child (their form teacher + subject teachers) */
router.get('/me/children/:childId/teachers', async (req, res) => {
  const ctx = await requireChild(req, res, req.params.childId);
  if (!ctx) return;
  const { child } = ctx;

  // Form teacher
  const [formT] = await pool.execute(
    `SELECT t.id, t.name, t.email, t.staff_no, t.subjects, 'form_teacher' AS role
     FROM classes c
     JOIN teachers t ON t.id = c.teacher_id
     WHERE c.name = ? LIMIT 1`,
    [child.class_name]
  );

  // Subject teachers assigned to this class
  const [subjectTs] = await pool.execute(
    `SELECT DISTINCT t.id, t.name, t.email, t.staff_no, t.subjects, 'subject_teacher' AS role
     FROM teacher_assignments ta
     JOIN teachers t ON t.id = ta.teacher_id
     WHERE ta.class_name = ?
     ORDER BY t.name`,
    [child.class_name]
  );

  // Merge + dedupe
  const seen = new Set();
  const out = [];
  for (const t of [...formT, ...subjectTs]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    let subjects = [];
    try { subjects = JSON.parse(t.subjects || '[]'); } catch { subjects = []; }
    out.push({
      id: t.id, name: t.name, email: t.email,
      staffNo: t.staff_no, subjects, role: t.role,
    });
  }

  res.json(out);
});

/* GET meetings */
router.get('/me/meetings', async (req, res) => {
  const { parent } = await getParentContext(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  const [rows] = await pool.execute(
    `SELECT m.*,
            t.name AS teacher_name, t.email AS teacher_email,
            s.name AS student_name, s.class_name AS student_class
     FROM meetings m
     JOIN teachers t ON t.id = m.teacher_id
     JOIN students s ON s.id = m.student_id
     WHERE m.parent_id = ?
     ORDER BY m.created_at DESC`,
    [parent.id]
  );

  res.json(rows.map((m) => ({
    id: m.id,
    topic: m.topic,
    message: m.message,
    preferredDate: m.preferred_date,
    preferredTime: m.preferred_time,
    durationMinutes: m.duration_minutes,
    status: m.status,
    scheduledDate: m.scheduled_date,
    scheduledTime: m.scheduled_time,
    teacherResponse: m.teacher_response,
    completedNotes: m.completed_notes,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    teacher: { id: m.teacher_id, name: m.teacher_name, email: m.teacher_email },
    student: { id: m.student_id, name: m.student_name, className: m.student_class },
  })));
});

/* POST create meeting request */
router.post('/me/meetings', async (req, res) => {
  const {
    teacherId, studentId, topic, message,
    preferredDate, preferredTime, durationMinutes,
  } = req.body;

  if (!teacherId || !studentId || !topic || !preferredDate || !preferredTime) {
    return res.status(400).json({
      message: 'teacherId, studentId, topic, preferredDate and preferredTime are required',
    });
  }

  const { parent, children } = await getParentContext(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  // The student must be one of the parent's children
  const child = children.find((c) => c.id === Number(studentId));
  if (!child) {
    return res.status(403).json({ message: 'That student is not linked to your account' });
  }

  // Verify the teacher exists
  const [teacherRows] = await pool.execute(
    'SELECT id, user_id, name FROM teachers WHERE id = ?',
    [teacherId]
  );
  if (!teacherRows.length) {
    return res.status(404).json({ message: 'Teacher not found' });
  }
  const teacher = teacherRows[0];

  const [result] = await pool.execute(
    `INSERT INTO meetings
       (parent_id, teacher_id, student_id, topic, message,
        preferred_date, preferred_time, duration_minutes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      parent.id, teacher.id, child.id,
      String(topic).trim(),
      String(message || '').trim(),
      preferredDate, preferredTime,
      Number(durationMinutes) || 20,
    ]
  );

  // Notify the teacher
  try {
    if (teacher.user_id) {
      await notify({
        userId: teacher.user_id,
        type: 'meeting',
        title: 'New meeting request',
        body: `${parent.name} wants to discuss "${topic}" (${child.name})`,
        link: '/teacher/meetings',
      });
    }
  } catch (e) { console.error('Notify teacher failed:', e.message); }

  const [rows] = await pool.execute('SELECT * FROM meetings WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Meeting request sent', meeting: rows[0] });
});

/* PATCH cancel */
router.patch('/me/meetings/:id/cancel', async (req, res) => {
  const { parent } = await getParentContext(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  const [rows] = await pool.execute(
    'SELECT * FROM meetings WHERE id = ? AND parent_id = ?',
    [req.params.id, parent.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Meeting not found' });

  if (rows[0].status === 'completed') {
    return res.status(400).json({ message: 'Cannot cancel a completed meeting' });
  }

  await pool.execute(
    `UPDATE meetings SET status = 'cancelled' WHERE id = ?`,
    [req.params.id]
  );

  // Notify teacher
  try {
    const [teacherRows] = await pool.execute(
      'SELECT user_id FROM teachers WHERE id = ?',
      [rows[0].teacher_id]
    );
    if (teacherRows.length && teacherRows[0].user_id) {
      await notify({
        userId: teacherRows[0].user_id,
        type: 'meeting',
        title: 'Meeting cancelled',
        body: `${parent.name} cancelled the meeting "${rows[0].topic}"`,
        link: '/teacher/meetings',
      });
    }
  } catch (e) { console.error('Notify failed:', e.message); }

  res.json({ message: 'Meeting cancelled' });
});

module.exports = router;