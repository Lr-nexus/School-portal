const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('admin'));

/* ============================================================
   GET /api/analytics/overview
   Big numbers + 3 simple series for the dashboard.
   ============================================================ */
router.get('/overview', async (req, res) => {
  try {
    // Top-level counts
    const [[{ totalStudents }]] = await pool.execute('SELECT COUNT(*) AS totalStudents FROM students');
    const [[{ totalTeachers }]] = await pool.execute('SELECT COUNT(*) AS totalTeachers FROM teachers');
    const [[{ totalClasses }]]  = await pool.execute('SELECT COUNT(*) AS totalClasses FROM classes');
    const [[{ totalParents }]]  = await pool.execute('SELECT COUNT(*) AS totalParents FROM parents');
    const [[{ totalQuizzes }]]  = await pool.execute('SELECT COUNT(*) AS totalQuizzes FROM quizzes');
    const [[{ totalSubs }]]     = await pool.execute('SELECT COUNT(*) AS totalSubs FROM quiz_submissions');

    // Fees
    const [feeRows] = await pool.execute('SELECT * FROM fees');
    let feesBilled = 0, feesPaid = 0;
    feeRows.forEach((f) => {
      const items = JSON.parse(f.items || '[]');
      feesBilled += items.reduce((s, i) => s + Number(i.amount), 0);
      feesPaid += parseFloat(f.amount_paid || 0);
    });

    // Attendance rate
    const [[att]] = await pool.execute(
      `SELECT
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
        COUNT(*) AS total
       FROM attendance`
    );
    const attTotal = Number(att.total || 0);
    const attPresent = Number(att.present || 0);
    const attendanceRate = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

    // Per-class average — average score across all results
    const [classAverages] = await pool.execute(
      `SELECT s.class_name AS className,
              ROUND(AVG(r.ca + r.exam)) AS average,
              COUNT(DISTINCT s.id) AS students
       FROM results r
       JOIN students s ON s.id = r.student_id
       GROUP BY s.class_name
       ORDER BY average DESC`
    );

    // Fee collection per class
    const [feeByClass] = await pool.execute(
      `SELECT s.class_name AS className,
              COUNT(DISTINCT s.id) AS students
       FROM students s
       GROUP BY s.class_name
       ORDER BY s.class_name`
    );
    for (const c of feeByClass) {
      const [classFees] = await pool.execute(
        `SELECT f.items, f.amount_paid FROM fees f
         JOIN students s ON s.id = f.student_id
         WHERE s.class_name = ?`,
        [c.className]
      );
      let billed = 0, paid = 0;
      classFees.forEach((f) => {
        const items = JSON.parse(f.items || '[]');
        billed += items.reduce((s, i) => s + Number(i.amount), 0);
        paid += parseFloat(f.amount_paid || 0);
      });
      c.billed = billed;
      c.paid = paid;
      c.collected = billed ? Math.round((paid / billed) * 100) : 0;
    }

    // Quiz performance per class
    const [quizPerClass] = await pool.execute(
      `SELECT s.class_name AS className,
              ROUND(AVG(100 * qs.score / qs.total)) AS average,
              COUNT(qs.id) AS submissions
       FROM quiz_submissions qs
       JOIN students s ON s.id = qs.student_id
       GROUP BY s.class_name
       ORDER BY average DESC`
    );

    // Top performing students (overall average across all results)
    const [topStudents] = await pool.execute(
      `SELECT s.id, s.name, s.class_name AS className,
              ROUND(AVG(r.ca + r.exam)) AS average,
              COUNT(r.id) AS subjects
       FROM results r
       JOIN students s ON s.id = r.student_id
       GROUP BY s.id, s.name, s.class_name
       HAVING subjects >= 3
       ORDER BY average DESC
       LIMIT 10`
    );

    res.json({
      counts: {
        students: totalStudents,
        teachers: totalTeachers,
        classes: totalClasses,
        parents: totalParents,
        quizzes: totalQuizzes,
        submissions: totalSubs,
      },
      fees: {
        billed: feesBilled,
        paid: feesPaid,
        outstanding: Math.max(feesBilled - feesPaid, 0),
        rate: feesBilled ? Math.round((feesPaid / feesBilled) * 100) : 0,
      },
      attendance: {
        present: attPresent,
        total: attTotal,
        rate: attendanceRate,
      },
      classAverages,
      feeByClass,
      quizPerClass,
      topStudents,
    });
  } catch (err) {
    console.error('Analytics failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load analytics' });
  }
});

module.exports = router;