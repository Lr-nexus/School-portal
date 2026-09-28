const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* ============================================================
   Existing — list, unread count, mark read, delete
   ============================================================ */

router.get('/me', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows.map(n => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    link: n.link, read: !!n.read, createdAt: n.created_at,
  })));
});

router.get('/me/unread-count', async (req, res) => {
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND `read` = 0',
    [req.user.id]
  );
  res.json({ count });
});

router.patch('/:id/read', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Notification not found' });
  await pool.execute('UPDATE notifications SET `read` = 1 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Marked read' });
});

router.patch('/read-all', async (req, res) => {
  await pool.execute('UPDATE notifications SET `read` = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All marked read' });
});

router.delete('/:id', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Notification not found' });
  await pool.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

/* ============================================================
   NEW — preferences
   ============================================================ */

router.get('/me/preferences', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM notification_prefs WHERE user_id = ?',
    [req.user.id]
  );

  if (!rows.length) {
    // Return defaults — don't create a row until they save
    return res.json({
      pushEnabled: true,
      emailDigestEnabled: true,
      digestFrequency: 'daily',
      deadlineReminders: true,
    });
  }

  const p = rows[0];
  res.json({
    pushEnabled: !!p.push_enabled,
    emailDigestEnabled: !!p.email_digest_enabled,
    digestFrequency: p.digest_frequency,
    deadlineReminders: !!p.deadline_reminders,
  });
});

router.patch('/me/preferences', async (req, res) => {
  const {
    pushEnabled, emailDigestEnabled, digestFrequency, deadlineReminders,
  } = req.body;

  const updates = [];
  const values = [];

  if (pushEnabled !== undefined) {
    updates.push('push_enabled = ?');
    values.push(pushEnabled ? 1 : 0);
  }
  if (emailDigestEnabled !== undefined) {
    updates.push('email_digest_enabled = ?');
    values.push(emailDigestEnabled ? 1 : 0);
  }
  if (digestFrequency !== undefined && ['daily', 'weekly', 'off'].includes(digestFrequency)) {
    updates.push('digest_frequency = ?');
    values.push(digestFrequency);
  }
  if (deadlineReminders !== undefined) {
    updates.push('deadline_reminders = ?');
    values.push(deadlineReminders ? 1 : 0);
  }

  if (!updates.length) return res.status(400).json({ message: 'Nothing to update' });

  try {
    // Upsert row
    await pool.execute(
      `INSERT INTO notification_prefs (user_id) VALUES (?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [req.user.id]
    );
    values.push(req.user.id);
    await pool.execute(
      `UPDATE notification_prefs SET ${updates.join(', ')} WHERE user_id = ?`,
      values
    );

    const [rows] = await pool.execute(
      'SELECT * FROM notification_prefs WHERE user_id = ?',
      [req.user.id]
    );
    const p = rows[0];
    res.json({
      message: 'Preferences updated',
      preferences: {
        pushEnabled: !!p.push_enabled,
        emailDigestEnabled: !!p.email_digest_enabled,
        digestFrequency: p.digest_frequency,
        deadlineReminders: !!p.deadline_reminders,
      },
    });
  } catch (err) {
    console.error('Prefs update failed:', err);
    res.status(500).json({ message: err.message || 'Update failed' });
  }
});

/* Admin/debug — trigger the scheduler now */
router.post('/admin/run-scheduler', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { runNow } = require('../utils/scheduler');
    await runNow();
    res.json({ message: 'Scheduler ran' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;