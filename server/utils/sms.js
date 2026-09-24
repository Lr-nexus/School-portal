/* ------------------------------------------------------------------
   SMS sender — uses Termii if TERMII_API_KEY is set, otherwise
   logs to console (dev fallback).
------------------------------------------------------------------- */

const TERMII_BASE = 'https://api.ng.termii.com/api';
const TERMII_KEY = process.env.TERMII_API_KEY || '';
const SENDER_ID = process.env.TERMII_SENDER_ID || 'SchoolPortal';

async function sendSms({ to, message }) {
  if (!to) return { ok: false, error: 'Missing phone number' };

  if (!TERMII_KEY) {
    console.log('\n📱 [SMS — CONSOLE FALLBACK]');
    console.log(`   To: ${to}`);
    console.log(`   Message: ${message}`);
    console.log('');
    return { ok: true, fallback: true };
  }

  try {
    const res = await fetch(`${TERMII_BASE}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TERMII_KEY,
        to,
        from: SENDER_ID,
        sms: message,
        type: 'plain',
        channel: 'generic',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('SMS failed:', data);
      return { ok: false, error: data.message || 'SMS send failed' };
    }
    console.log(`📱 SMS sent to ${to}: ${data.message_id || 'ok'}`);
    return { ok: true, id: data.message_id };
  } catch (err) {
    console.error('SMS request error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendSms };