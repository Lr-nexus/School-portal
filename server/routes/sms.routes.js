const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { sendSms } = require('../utils/sms');

router.use(protect, allow('admin'));

/* ============================================================
   GET /api/sms/audience
   Returns classes + a sample count of guardians with phone numbers
   ============================================================ */
router.get('/audience', async (req, res) => {
  const [classes] = await pool.execute(
    `SELECT class_name, COUNT(*) AS count,
            SUM(CASE WHEN guardian_phone IS NOT NULL AND guardian_phone != '' THEN 1 ELSE 0 END) AS with_phone
     FROM students
     GROUP BY class_name
     ORDER BY class_name`
  );

  const [[total]] = await pool.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN guardian_phone IS NOT NULL AND guardian_phone != '' THEN 1 ELSE 0 END) AS with_phone
     FROM students`
  );

  res.json({
    classes: classes.map((c) => ({
      className: c.class_name,
      students: Number(c.count),
      withPhone: Number(c.with_phone),
    })),
    total: Number(total.total),
    totalWithPhone: Number(total.with_phone),
  });
});

/* ============================================================
   POST /api/sms/send
   body: { className, message }
   className = 'ALL' or a specific class
   ============================================================ */
router.post('/send', async (req, res) => {
  const { className, message } = req.body;

  if (!className || !message || String(message).trim().length < 5) {
    return res.status(400).json({
      message: 'className and a message of at least 5 characters are required',
    });
  }

  let recipients;
  if (className === 'ALL') {
    [recipients] = await pool.execute(
      `SELECT name, guardian_name, guardian_phone
       FROM students
       WHERE guardian_phone IS NOT NULL AND guardian_phone != ''`
    );
  } else {
    [recipients] = await pool.execute(
      `SELECT name, guardian_name, guardian_phone
       FROM students
       WHERE class_name = ?
         AND guardian_phone IS NOT NULL AND guardian_phone != ''`,
      [className]
    );
  }

  if (!recipients.length) {
    return res.status(400).json({ message: 'No guardians with phone numbers found' });
  }

  const results = [];
  let sent = 0, failed = 0;

  for (const r of recipients) {
    const personalized = String(message).replace(/\{student\}/g, r.name);
    const smsRes = await sendSms({ to: r.guardian_phone, message: personalized });

    if (smsRes.ok) sent += 1;
    else failed += 1;

    // Log every attempt
    await pool.execute(
      `INSERT INTO sms_log (phone, message, status, provider, response)
       VALUES (?, ?, ?, ?, ?)`,
      [
        r.guardian_phone,
        personalized,
        smsRes.ok ? 'sent' : 'failed',
        smsRes.fallback ? 'console' : 'termii',
        smsRes.id || smsRes.error || null,
      ]
    );

    results.push({
      name: r.name,
      guardian: r.guardian_name,
      phone: r.guardian_phone,
      status: smsRes.ok ? 'sent' : 'failed',
    });
  }

  res.json({
    message: `Sent ${sent} SMS, ${failed} failed`,
    sent,
    failed,
    total: recipients.length,
    results,
  });
});

/* ============================================================
   GET /api/sms/log
   Recent SMS log
   ============================================================ */
router.get('/log', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, phone, message, status, provider, created_at
     FROM sms_log
     ORDER BY id DESC
     LIMIT 100`
  );
  res.json(rows);
});

module.exports = router;