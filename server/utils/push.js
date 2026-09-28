/* ------------------------------------------------------------------
   Web Push sender — uses web-push + VAPID
------------------------------------------------------------------- */

const pool = require('../db');

let webpush = null;
let configured = false;

try {
  webpush = require('web-push');
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || 'mailto:admin@school.local';

  if (pub && priv) {
    webpush.setVapidDetails(subj, pub, priv);
    configured = true;
    console.log('🔔 Web Push configured');
  } else {
    console.log('🔔 Web Push disabled — VAPID keys not set');
  }
} catch (e) {
  console.log('🔔 Web Push disabled — web-push not installed');
}

/**
 * Send a push notification to every subscription this user has.
 * Silently drops dead subscriptions (410 Gone).
 *
 * @param {number} userId
 * @param {Object} payload { title, body, url, icon, tag }
 * @returns {Promise<{sent:number,failed:number}>}
 */
async function sendPushToUser(userId, payload) {
  if (!configured) return { sent: 0, failed: 0 };

  const [subs] = await pool.execute(
    'SELECT * FROM push_subscriptions WHERE user_id = ?',
    [userId]
  );

  if (!subs.length) return { sent: 0, failed: 0 };

  const message = JSON.stringify({
    title: payload.title || 'Bright Future',
    body: payload.body || '',
    url: payload.url || '/',
    icon: payload.icon || '/school-logo.png',
    tag: payload.tag || 'bright-future',
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message
      );
      sent++;
      await pool.execute(
        'UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = ?',
        [sub.id]
      );
    } catch (err) {
      failed++;
      // 404 or 410 means the subscription is dead — clean it up
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      } else {
        console.error(`Push failed for user ${userId}:`, err.message);
      }
    }
  }

  return { sent, failed };
}

module.exports = { sendPushToUser, configured };