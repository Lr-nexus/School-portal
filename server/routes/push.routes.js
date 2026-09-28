const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* GET /api/push/vapid-public-key — the client needs this to subscribe */
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  if (!key) return res.status(503).json({ message: 'Push not configured' });
  res.json({ publicKey: key });
});

/* POST /api/push/subscribe — register a subscription */
router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'Invalid subscription payload' });
  }

  try {
    await pool.execute(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         p256dh = VALUES(p256dh),
         auth = VALUES(auth),
         user_agent = VALUES(user_agent),
         last_used_at = NOW()`,
      [
        req.user.id,
        endpoint,
        keys.p256dh,
        keys.auth,
        String(req.headers['user-agent'] || '').slice(0, 255),
      ]
    );
    res.json({ message: 'Subscribed' });
  } catch (err) {
    console.error('Push subscribe failed:', err);
    res.status(500).json({ message: err.message || 'Subscribe failed' });
  }
});

/* POST /api/push/unsubscribe — remove a subscription */
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ message: 'endpoint is required' });

  await pool.execute(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [req.user.id, endpoint]
  );
  res.json({ message: 'Unsubscribed' });
});

/* POST /api/push/test — send a test push to the logged-in user */
router.post('/test', async (req, res) => {
  const { sendPushToUser, configured } = require('../utils/push');
  if (!configured) return res.status(503).json({ message: 'Push not configured' });

  const result = await sendPushToUser(req.user.id, {
    title: '🎉 Test notification',
    body: 'Push notifications are working!',
    url: '/',
  });
  res.json({ message: `Sent to ${result.sent} device(s)`, ...result });
});

module.exports = router;