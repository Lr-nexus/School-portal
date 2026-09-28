const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* GET state — returns tour status + dismissed tips */
router.get('/', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM onboarding_state WHERE user_id = ?',
    [req.user.id]
  );
  if (!rows.length) {
    return res.json({ tourCompleted: false, dismissedTips: [] });
  }
  const r = rows[0];
  let dismissedTips = [];
  try { dismissedTips = JSON.parse(r.dismissed_tips || '[]'); } catch {}
  res.json({
    tourCompleted: !!r.tour_completed,
    tourCompletedAt: r.tour_completed_at,
    dismissedTips,
  });
});

/* Complete the tour */
router.post('/complete', async (req, res) => {
  await pool.execute(
    `INSERT INTO onboarding_state (user_id, tour_completed, tour_completed_at)
     VALUES (?, 1, NOW())
     ON DUPLICATE KEY UPDATE
       tour_completed = 1,
       tour_completed_at = NOW()`,
    [req.user.id]
  );
  res.json({ message: 'Tour marked complete' });
});

/* Reset the tour (used by the "Take tour again" button) */
router.post('/reset', async (req, res) => {
  await pool.execute(
    `INSERT INTO onboarding_state (user_id, tour_completed)
     VALUES (?, 0)
     ON DUPLICATE KEY UPDATE tour_completed = 0`,
    [req.user.id]
  );
  res.json({ message: 'Tour reset' });
});

/* Dismiss a specific tip (a small popup, not the whole tour) */
router.post('/dismiss-tip', async (req, res) => {
  const tipId = String(req.body.tipId || '').trim();
  if (!tipId) return res.status(400).json({ message: 'tipId is required' });

  const [rows] = await pool.execute(
    'SELECT dismissed_tips FROM onboarding_state WHERE user_id = ?',
    [req.user.id]
  );
  let tips = [];
  if (rows.length) {
    try { tips = JSON.parse(rows[0].dismissed_tips || '[]'); } catch {}
  }
  if (!tips.includes(tipId)) tips.push(tipId);

  await pool.execute(
    `INSERT INTO onboarding_state (user_id, dismissed_tips)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE dismissed_tips = VALUES(dismissed_tips)`,
    [req.user.id, JSON.stringify(tips)]
  );
  res.json({ message: 'Tip dismissed', dismissedTips: tips });
});

module.exports = router;