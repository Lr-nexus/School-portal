const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('admin'));

const SCHOOL = {
  name: 'Bright Future Secondary School',
  address: '12 Learning Road, Ikeja, Lagos, Nigeria',
  phone: '+234 800 000 0000',
  email: 'office@brightfuture.edu.ng',
  motto: 'Knowledge · Character · Service',
};

/* ============================================================
   GET /api/bulk/classes
   Classes with student counts for the export picker
   ============================================================ */
router.get('/classes', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.name AS className, COUNT(s.id) AS studentCount
       FROM classes c
       LEFT JOIN students s ON s.class_name = c.name
       GROUP BY c.name
       ORDER BY c.name`
    );
    res.json(rows.map((r) => ({
      className: r.className,
      studentCount: Number(r.studentCount),
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/bulk/fee-receipts/:className?session=&term=
   All receipts for every student in a class
   ============================================================ */
router.get('/fee-receipts/:className', async (req, res) => {
  const className = decodeURIComponent(req.params.className);
  const { session, term } = req.query;

  try {
    const where = ['s.class_name = ?'];
    const values = [className];
    if (session) { where.push('f.session = ?'); values.push(session); }
    if (term)    { where.push('f.term = ?');    values.push(term); }

    const [rows] = await pool.execute(
      `SELECT f.*, s.name AS student_name, s.admission_no, s.class_name,
              s.house, s.guardian_name, s.guardian_phone, s.department
       FROM fees f
       JOIN students s ON s.id = f.student_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.name, f.session, f.term`,
      values
    );

    const receipts = rows.map((f) => {
      const items = JSON.parse(f.items || '[]');
      const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
      const paid = parseFloat(f.amount_paid);
      const balance = Math.max(total - paid, 0);
      return {
        id: f.id,
        receiptNo: `RCPT-${f.reference}-${f.id}`,
        invoiceNo: `INV-${f.reference}`,
        paidOn: f.date,
        session: f.session,
        term: f.term,
        reference: f.reference,
        method: f.method || '—',
        student: {
          name: f.student_name,
          admissionNo: f.admission_no,
          className: f.class_name,
          house: f.house,
          guardianName: f.guardian_name,
          guardianPhone: f.guardian_phone,
        },
        items,
        total,
        amountPaid: paid,
        balance,
        status: balance <= 0 ? 'PAID IN FULL' : 'PART PAYMENT',
      };
    });

    res.json({
      school: SCHOOL,
      className,
      session: session || 'All',
      term: term || 'All',
      count: receipts.length,
      receipts,
    });
  } catch (err) {
    console.error('Bulk receipts failed:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/bulk/id-cards/:className
   ID card data for every student in a class
   ============================================================ */
router.get('/id-cards/:className', async (req, res) => {
  const className = decodeURIComponent(req.params.className);
  const validThrough = `${new Date().getFullYear() + 1}-08-31`;

  try {
    const [students] = await pool.execute(
      `SELECT * FROM students WHERE class_name = ? ORDER BY name`,
      [className]
    );

    res.json({
      school: {
        name: SCHOOL.name,
        address: '12 Learning Road, Ikeja, Lagos',
        phone: SCHOOL.phone,
        motto: SCHOOL.motto,
      },
      className,
      validThrough,
      issuedAt: new Date().toISOString().split('T')[0],
      count: students.length,
      students: students.map((s) => ({
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
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;