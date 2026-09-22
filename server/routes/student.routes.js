const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');

router.use(protect, allow('student'));

router.get('/me', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ message: 'Student not found' });
  const s = rows[0];
  res.json({
    id: s.id,
    name: s.name,
    admissionNo: s.admission_no,
    className: s.class_name,
    gender: s.gender,
    dob: s.dob,
    guardianName: s.guardian_name,
    guardianPhone: s.guardian_phone,
    address: s.address,
    email: s.email,
    house: s.house,
  });
});

router.patch('/me', async (req, res) => {
  const [existing] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
  if (!existing.length) return res.status(404).json({ message: 'Student not found' });

  const map = {
    name: 'name', gender: 'gender', dob: 'dob', email: 'email',
    guardianName: 'guardian_name', guardianPhone: 'guardian_phone', address: 'address',
  };
  const updates = [], values = [];
  for (const [key, field] of Object.entries(map)) {
    if (req.body[key] !== undefined) { updates.push(`${field} = ?`); values.push(req.body[key]); }
  }
  if (updates.length) {
    values.push(req.user.id);
    await pool.execute(`UPDATE students SET ${updates.join(', ')} WHERE user_id = ?`, values);
  }

  const [rows] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
  const s = rows[0];
  res.json({
    message: 'Profile updated',
    student: {
      id: s.id, name: s.name, admissionNo: s.admission_no, className: s.class_name,
      gender: s.gender, dob: s.dob, guardianName: s.guardian_name,
      guardianPhone: s.guardian_phone, address: s.address, email: s.email, house: s.house,
    }
  });
});

router.get('/me/classes', async (req, res) => {
  const [studentRows] = await pool.execute('SELECT class_name FROM students WHERE user_id = ?', [req.user.id]);
  if (!studentRows.length) return res.json({ className: null, subjects: [], schedule: [], classmates: [] });
  const className = studentRows[0].class_name;

  const [classRows] = await pool.execute('SELECT * FROM classes WHERE name = ?', [className]);
  if (!classRows.length) return res.json({ className, subjects: [], schedule: [], classmates: [] });

  const myClass = classRows[0];
  const [classmates] = await pool.execute(
    'SELECT id, name, admission_no FROM students WHERE class_name = ?',
    [className]
  );

  res.json({
    id: myClass.id,
    name: myClass.name,
    subjects: JSON.parse(myClass.subjects || '[]'),
    schedule: JSON.parse(myClass.schedule || '[]'),
    classmates: classmates.map(c => ({ id: c.id, name: c.name, admissionNo: c.admission_no })),
  });
});

router.get('/me/results', async (req, res) => {
  const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
  if (!studentRows.length) return res.json({ session: '', term: '', subjects: [], average: 0, overallGrade: 'F' });

  const [rows] = await pool.execute('SELECT * FROM results WHERE student_id = ? ORDER BY subject', [studentRows[0].id]);

  const formatted = rows.map((r) => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    return { id: r.id, subject: r.subject, ca: r.ca, exam: r.exam, total, grade, remark };
  });
  const average = formatted.length
    ? Math.round(formatted.reduce((sum, r) => sum + r.total, 0) / formatted.length)
    : 0;

  res.json({
    session: rows[0]?.session || '2024/2025',
    term: rows[0]?.term || 'First Term',
    subjects: formatted,
    average,
    overallGrade: gradeFor(average).grade,
  });
});

router.get('/me/fees', async (req, res) => {
  const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
  if (!studentRows.length) return res.json([]);

  const [rows] = await pool.execute('SELECT * FROM fees WHERE student_id = ?', [studentRows[0].id]);
  res.json(rows.map((f) => {
    const items = JSON.parse(f.items || '[]');
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const paid = parseFloat(f.amount_paid);
    const balance = total - paid;
    return {
      id: f.id, session: f.session, term: f.term, items,
      amountPaid: paid, total, balance,
      status: balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
      date: f.date, reference: f.reference, method: f.method,
    };
  }));
});

router.get('/me/fees/:id/receipt', async (req, res) => {
  const [studentRows] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
  if (!studentRows.length) return res.status(404).json({ message: 'Student not found' });
  const student = studentRows[0];

  const [feeRows] = await pool.execute('SELECT * FROM fees WHERE id = ? AND student_id = ?', [req.params.id, student.id]);
  if (!feeRows.length) return res.status(404).json({ message: 'Fee record not found' });
  const fee = feeRows[0];

  const items = JSON.parse(fee.items || '[]');
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const paid = parseFloat(fee.amount_paid);

  res.json({
    school: 'Bright Future Secondary School',
    address: '12 Learning Road, Lagos, Nigeria',
    receiptNo: `RCPT-${fee.reference}`,
    date: fee.date,
    studentName: student.name,
    admissionNo: student.admission_no,
    className: student.class_name,
    session: fee.session,
    term: fee.term,
    items, total, amountPaid: paid, balance: total - paid,
    method: fee.method,
    status: total - paid <= 0 ? 'PAID' : 'PART PAYMENT',
  });
});

router.get('/me/announcements', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC');
  res.json(rows);
});

module.exports = router;