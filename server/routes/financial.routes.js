const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('admin'));

/* Helper: expand items JSON and return billed */
function billedOf(row) {
  const items = JSON.parse(row.items || '[]');
  return items.reduce((s, i) => s + Number(i.amount || 0), 0);
}

/* ============================================================
   GET /api/financial/overview
   ============================================================ */
router.get('/overview', async (req, res) => {
  const { from, to } = req.query;
  try {
    const where = [];
    const values = [];
    if (from) { where.push('date >= ?'); values.push(from); }
    if (to)   { where.push('date <= ?'); values.push(to); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [fees] = await pool.execute(
      `SELECT student_id, items, amount_paid, date, method
       FROM fees ${whereSQL}`,
      values
    );

    let billed = 0;
    let collected = 0;
    let fullyPaid = 0;
    let partial = 0;
    let unpaid = 0;
    const methods = {};

    for (const f of fees) {
      const total = billedOf(f);
      const paid = parseFloat(f.amount_paid || 0);
      billed += total;
      collected += paid;

      if (total <= 0) continue;
      if (paid <= 0) unpaid++;
      else if (paid >= total) fullyPaid++;
      else partial++;

      if (paid > 0) {
        const m = f.method || 'Unspecified';
        methods[m] = (methods[m] || 0) + paid;
      }
    }

    const [[{ studentCount }]] = await pool.execute(
      'SELECT COUNT(*) AS studentCount FROM students'
    );

    res.json({
      billed,
      collected,
      outstanding: Math.max(billed - collected, 0),
      collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      fullyPaid,
      partial,
      unpaid,
      studentCount: Number(studentCount),
      methods: Object.entries(methods)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    });
  } catch (err) {
    console.error('Financial overview failed:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/financial/by-term?session=
   ============================================================ */
router.get('/by-term', async (req, res) => {
  const session = req.query.session || null;
  try {
    const [rows] = await pool.execute(
      session
        ? `SELECT term, items, amount_paid FROM fees WHERE session = ?`
        : `SELECT term, items, amount_paid FROM fees`,
      session ? [session] : []
    );

    const buckets = {};
    for (const r of rows) {
      const b = buckets[r.term] ||= { term: r.term, billed: 0, collected: 0 };
      b.billed += billedOf(r);
      b.collected += parseFloat(r.amount_paid || 0);
    }

    const ordered = ['First Term', 'Second Term', 'Third Term']
      .map((t) => buckets[t])
      .filter(Boolean);

    res.json(ordered.map((b) => ({
      term: b.term,
      billed: b.billed,
      collected: b.collected,
      outstanding: Math.max(b.billed - b.collected, 0),
      rate: b.billed > 0 ? Math.round((b.collected / b.billed) * 100) : 0,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/financial/by-class?session=&term=
   ============================================================ */
router.get('/by-class', async (req, res) => {
  const { session, term } = req.query;
  try {
    const where = [];
    const values = [];
    if (session) { where.push('f.session = ?'); values.push(session); }
    if (term)    { where.push('f.term = ?');    values.push(term); }
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT s.class_name, f.items, f.amount_paid
       FROM fees f
       JOIN students s ON s.id = f.student_id
       ${whereSQL}`,
      values
    );

    const buckets = {};
    for (const r of rows) {
      const b = buckets[r.class_name] ||= {
        className: r.class_name, billed: 0, collected: 0, studentCount: new Set(),
      };
      b.billed += billedOf(r);
      b.collected += parseFloat(r.amount_paid || 0);
    }

    res.json(
      Object.values(buckets)
        .map((b) => ({
          className: b.className,
          billed: b.billed,
          collected: b.collected,
          outstanding: Math.max(b.billed - b.collected, 0),
          rate: b.billed > 0 ? Math.round((b.collected / b.billed) * 100) : 0,
        }))
        .sort((a, b) => a.className.localeCompare(b.className))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/financial/debtors?limit=20
   ============================================================ */
router.get('/debtors', async (req, res) => {
  const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
  try {
    const [rows] = await pool.execute(
      `SELECT f.student_id, f.items, f.amount_paid,
              s.name, s.class_name, s.admission_no, s.guardian_name, s.guardian_phone
       FROM fees f
       JOIN students s ON s.id = f.student_id`
    );

    const byStudent = {};
    for (const r of rows) {
      const b = byStudent[r.student_id] ||= {
        studentId: r.student_id,
        name: r.name,
        className: r.class_name,
        admissionNo: r.admission_no,
        guardianName: r.guardian_name,
        guardianPhone: r.guardian_phone,
        billed: 0,
        paid: 0,
      };
      b.billed += billedOf(r);
      b.paid += parseFloat(r.amount_paid || 0);
    }

    res.json(
      Object.values(byStudent)
        .map((s) => ({ ...s, balance: Math.max(s.billed - s.paid, 0) }))
        .filter((s) => s.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, limit)
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/financial/trend?months=12
   ============================================================ */
router.get('/trend', async (req, res) => {
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 12));
  try {
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS ym,
              SUM(amount_paid) AS collected
       FROM fees
       WHERE date IS NOT NULL
         AND date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY ym
       ORDER BY ym ASC`,
      [months]
    );

    res.json(rows.map((r) => ({
      month: r.ym,
      collected: Number(r.collected || 0),
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/financial/recent?limit=15
   ============================================================ */
router.get('/recent', async (req, res) => {
  const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 15));
  try {
    const [rows] = await pool.execute(
      `SELECT f.id, f.date, f.amount_paid, f.method, f.reference,
              f.session, f.term, f.items,
              s.name, s.class_name, s.admission_no
       FROM fees f
       JOIN students s ON s.id = f.student_id
       WHERE f.amount_paid > 0
       ORDER BY f.date DESC, f.id DESC
       LIMIT ${limit}`
    );

    res.json(rows.map((r) => ({
      id: r.id,
      date: r.date,
      amountPaid: parseFloat(r.amount_paid || 0),
      total: billedOf(r),
      method: r.method || '—',
      reference: r.reference,
      session: r.session,
      term: r.term,
      student: {
        name: r.name,
        className: r.class_name,
        admissionNo: r.admission_no,
      },
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;