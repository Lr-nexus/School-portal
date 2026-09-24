/* ------------------------------------------------------------------
   Email sender — uses Resend if RESEND_API_KEY is set,
   otherwise logs to console (development fallback).
------------------------------------------------------------------- */

let resend = null;
try {
  const { Resend } = require('resend');
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
} catch {
  // resend package not installed — will use console fallback
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = process.env.FROM_NAME || 'School Portal';

async function sendEmail({ to, subject, html, text }) {
  const payload = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: text || stripHtml(html),
  };

  if (!resend) {
    console.log('\n📧 [EMAIL — CONSOLE FALLBACK]');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text || stripHtml(html)}`);
    console.log('');
    return { ok: true, fallback: true };
  }

  try {
    const res = await resend.emails.send(payload);
    console.log(`📧 Email sent to ${to}: ${res.id || 'ok'}`);
    return { ok: true, id: res.id };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ---------- Templates ---------- */

function welcomeEmail({ name, email, password, role, loginUrl }) {
  return {
    subject: `Welcome to ${FROM_NAME}`,
    html: `
      <div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:24px;color:#0b1220">
        <h2 style="color:#2563eb">Welcome, ${escapeHtml(name)}!</h2>
        <p>Your <strong>${escapeHtml(role)}</strong> account has been created.</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
        <strong>Password:</strong> ${escapeHtml(password)}</p>
        <p>Sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
        <p style="color:#64748b;font-size:12px">Change your password after first login.</p>
      </div>
    `,
  };
}

function passwordResetEmail({ name, resetUrl, expiryMinutes = 60 }) {
  return {
    subject: `Reset your password — ${FROM_NAME}`,
    html: `
      <div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:24px;color:#0b1220">
        <h2>Hi ${escapeHtml(name)},</h2>
        <p>Someone requested a password reset for your account. If that was you, click the button below.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">Reset Password</a>
        </p>
        <p>Or copy this link into your browser:<br/>
        <a href="${resetUrl}">${resetUrl}</a></p>
        <p style="color:#64748b;font-size:12px">The link expires in ${expiryMinutes} minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

module.exports = { sendEmail, welcomeEmail, passwordResetEmail };