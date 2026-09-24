const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');

router.use(protect, allow('parent'));

/* Helper — get the parent row + their linked student */
async function getParentAndChild(userId) {
  const [parentRows] = await pool.execute(
    'SELECT * FROM parents WHERE user_id = ?',
    [userId]
  );
  if (!parentRows.length) return { parent: null, child: null };

  const parent = parentRows[0];
  const [childRows] = await pool.execute(
    'SELECT * FROM students WHERE parent_id = ? LIMIT 1',
    [parent.id]
  );

  return { parent, child: childRows[0] || null };
}

/* ============================================================
   GET /api/parents/me — parent profile + child summary
   ============================================================ */
router.get('/me', async (req, res) => {
  const { parent, child } = await getParentAndChild(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  // Attendance summary
  let attendance = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };
  let results = { average: 0, overallGrade: 'F', subjectCount: 0 };
  let fees = { total: 0, paid: 0, outstanding: 0 };

  if (child) {
    const [[att]] = await pool.execute(
      `SELECT
         SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
         SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
         SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
         COUNT(*) AS total
       FROM attendance WHERE student_id = ?`,
      [child.id]
    );
    const total = Number(att.total || 0);
    attendance = {
      present: Number(att.present || 0),
      absent: Number(att.absent || 0),
      late: Number(att.late || 0),
      total,
      percentage: total ? Math.round((Number(att.present) / total) * 100) : 0,
    };

    // Latest result average (most recent session/term combo)
    const [latest] = await pool.execute(
      `SELECT session, term FROM results WHERE student_id = ?
       ORDER BY session DESC, term DESC LIMIT 1`,
      [child.id]
    );
    if (latest.length) {
      const [rows] = await pool.execute(
        `SELECT * FROM results WHERE student_id = ? AND session = ? AND term = ?`,
        [child.id, latest[0].session, latest[0].term]
      );
      const totals = rows.map((r) => totalOf(r));
      const avg = totals.length
        ? Math.round(totals.reduce((s, x) => s + x, 0) / totals.length)
        : 0;
      results = {
        average: avg,
        overallGrade: gradeFor(avg).grade,
        subjectCount: rows.length,
        session: latest[0].session,
        term: latest[0].term,
      };
    }

    // Fees
    const [feeRows] = await pool.execute(
      'SELECT * FROM fees WHERE student_id = ?',
      [child.id]
    );
    let totalBilled = 0, totalPaid = 0;
    feeRows.forEach((f) => {
      const items = JSON.parse(f.items || '[]');
      totalBilled += items.reduce((s, i) => s + Number(i.amount), 0);
      totalPaid += parseFloat(f.amount_paid || 0);
    });
    fees = {
      total: totalBilled,
      paid: totalPaid,
      outstanding: Math.max(totalBilled - totalPaid, 0),
    };
  }

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
    child: child
      ? {
          id: child.id,
          name: child.name,
          admissionNo: child.admission_no,
          className: child.class_name,
          gender: child.gender,
          house: child.house,
          email: child.email,
        }
      : null,
    attendance,
    results,
    fees,
  });
});

/* ============================================================
   PATCH /api/parents/me — update parent profile
   ============================================================ */
router.patch('/me', async (req, res) => {
  const { parent } = await getParentAndChild(req.user.id);
  if (!parent) return res.status(404).json({ message: 'Parent not found' });

  const map = { name: 'name', email: 'email', phone: 'phone', relationship: 'relationship', address: 'address' };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (updates.length) {
    values.push(req.user.id);
    await pool.execute(`UPDATE parents SET ${updates.join(', ')} WHERE user_id = ?`, values);
  }

  // Sync users table
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

/* ============================================================
   GET /api/parents/me/child/results?session=&term=
   ============================================================ */
router.get('/me/child/results', async (req, res) => {
  const { child } = await getParentAndChild(req.user.id);
  if (!child) return res.status(404).json({ message: 'No child linked' });

  const [combos] = await pool.execute(
    `SELECT DISTINCT session, term FROM results
     WHERE student_id = ? ORDER BY session DESC, term ASC`,
    [child.id]
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
    [child.id, session, term]
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
    child: {
      id: child.id, name: child.name,
      className: child.class_name, admissionNo: child.admission_no,
    },
    sessions: [...new Set(combos.map((c) => c.session))],
    terms: ['First Term', 'Second Term', 'Third Term'],
    current: { session: session || '', term: term || '' },
    subjects: formatted,
    average,
    overallGrade: gradeFor(average).grade,
  });
});

/* ============================================================
   GET /api/parents/me/child/attendance
   ============================================================ */
router.get('/me/child/attendance', async (req, res) => {
  const { child } = await getParentAndChild(req.user.id);
  if (!child) return res.status(404).json({ message: 'No child linked' });

  const [records] = await pool.execute(
    `SELECT date, status, note FROM attendance WHERE student_id = ?
     ORDER BY date DESC LIMIT 60`,
    [child.id]
  );

  const [[summary]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent,
       SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late,
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

/* ============================================================
   GET /api/parents/me/child/timetable
   ============================================================ */
router.get('/me/child/timetable', async (req, res) => {
  const { child } = await getParentAndChild(req.user.id);
  if (!child) return res.status(404).json({ message: 'No child linked' });

  const [rows] = await pool.execute(
    `SELECT t.*, te.name AS teacher_name
     FROM timetables t
     LEFT JOIN teachers te ON te.id = t.teacher_id
     WHERE t.class_name = ?
     ORDER BY FIELD(t.day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), t.period`,
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

/* ============================================================
   GET /api/parents/me/child/fees
   ============================================================ */
router.get('/me/child/fees', async (req, res) => {
  const { child } = await getParentAndChild(req.user.id);
  if (!child) return res.status(404).json({ message: 'No child linked' });

  const [rows] = await pool.execute(
    'SELECT * FROM fees WHERE student_id = ? ORDER BY date DESC',
    [child.id]
  );

  res.json(rows.map((f) => {
    const items = JSON.parse(f.items || '[]');
    const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
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

/* ============================================================
   POST /api/parents/me/child/fees/:id/pay — simulated payment
   ============================================================ */
router.post('/me/child/fees/:id/pay', async (req, res) => {
  const { child } = await getParentAndChild(req.user.id);
  if (!child) return res.status(404).json({ message: 'No child linked' });

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
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
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
  const newTotal = newItems.reduce((sum, i) => sum + Number(i.amount), 0);
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

/* ============================================================
   GET /api/parents/me/child/fees/:id/receipt
   ============================================================ */
router.get('/me/child/fees/:id/receipt', async (req, res) => {
  const { child } = await getParentAndChild(req.user.id);
  if (!child) return res.status(404).json({ message: 'No child linked' });

  const [feeRows] = await pool.execute(
    'SELECT * FROM fees WHERE id = ? AND student_id = ?',
    [req.params.id, child.id]
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

/* ============================================================
   GET /api/parents/me/announcements
   ============================================================ */
router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC');
  res.json(rows);
});

module.exports = router;