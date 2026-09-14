const router = require('express').Router();
const { students, classes, results, fees, announcements } = require('../data/db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');

// every route below is for logged-in students only
router.use(protect, allow('student'));

// ---------- PROFILE ----------
router.get('/me', (req, res) => {
  const student = students.find((s) => s.id === req.user.profileId);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json(student);
});

// ---------- UPDATE OWN PROFILE ----------
// PATCH /api/students/me
router.patch('/me', (req, res) => {
  const student = students.find((s) => s.id === req.user.profileId);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const editable = [
    'name', 'gender', 'dob', 'email',
    'guardianName', 'guardianPhone', 'address'
  ];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) student[field] = req.body[field];
  });

  res.json({ message: 'Profile updated', student });
});

// ---------- CLASSES ----------
router.get('/me/classes', (req, res) => {
  const myClass = classes.find((c) => c.studentIds.includes(req.user.profileId));
  if (!myClass) return res.json({ className: null, subjects: [], schedule: [], classmates: [] });

  const classmates = students
    .filter((s) => myClass.studentIds.includes(s.id))
    .map((s) => ({ id: s.id, name: s.name, admissionNo: s.admissionNo }));

  res.json({ ...myClass, classmates });
});

// ---------- RESULTS ----------
router.get('/me/results', (req, res) => {
  const mine = results.filter((r) => r.studentId === req.user.profileId);

  const formatted = mine.map((r) => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    return { ...r, total, grade, remark };
  });

  const average = formatted.length
    ? Math.round(formatted.reduce((sum, r) => sum + r.total, 0) / formatted.length)
    : 0;

  res.json({
    session: formatted[0]?.session || '2024/2025',
    term: formatted[0]?.term || 'First Term',
    subjects: formatted,
    average,
    overallGrade: gradeFor(average).grade
  });
});

// ---------- FEES ----------
router.get('/me/fees', (req, res) => {
  const mine = fees
    .filter((f) => f.studentId === req.user.profileId)
    .map((f) => {
      const total = f.items.reduce((sum, i) => sum + i.amount, 0);
      const balance = total - f.amountPaid;
      const status = balance <= 0 ? 'Paid' : f.amountPaid > 0 ? 'Partial' : 'Unpaid';
      return { ...f, total, balance, status };
    });

  res.json(mine);
});

// POST /api/students/me/fees/:id/pay
router.post('/me/fees/:id/pay', (req, res) => {
  const fee = fees.find(
    (f) => f.id === Number(req.params.id) && f.studentId === req.user.profileId
  );
  if (!fee) return res.status(404).json({ message: 'Fee record not found' });

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Enter a valid amount' });
  }

  const total = fee.items.reduce((sum, i) => sum + i.amount, 0);
  fee.amountPaid = Math.min(fee.amountPaid + amount, total);
  fee.method = req.body.method || 'Card';
  fee.date = new Date().toISOString().split('T')[0];

  res.json({ message: 'Payment successful', fee });
});

// ---------- RECEIPT ----------
router.get('/me/fees/:id/receipt', (req, res) => {
  const fee = fees.find(
    (f) => f.id === Number(req.params.id) && f.studentId === req.user.profileId
  );
  if (!fee) return res.status(404).json({ message: 'Fee record not found' });

  const student = students.find((s) => s.id === req.user.profileId);
  const total = fee.items.reduce((sum, i) => sum + i.amount, 0);

  res.json({
    school: 'Bright Future Secondary School',
    address: '12 Learning Road, Lagos, Nigeria',
    receiptNo: `RCPT-${fee.reference}`,
    date: fee.date,
    studentName: student.name,
    admissionNo: student.admissionNo,
    className: student.className,
    session: fee.session,
    term: fee.term,
    items: fee.items,
    total,
    amountPaid: fee.amountPaid,
    balance: total - fee.amountPaid,
    method: fee.method,
    status: total - fee.amountPaid <= 0 ? 'PAID' : 'PART PAYMENT'
  });
});

// ---------- ANNOUNCEMENTS ----------
router.get('/me/announcements', (req, res) => {
  res.json(announcements);
});

module.exports = router;