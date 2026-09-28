/* ------------------------------------------------------------------
   HTML templates for student / parent email digests
------------------------------------------------------------------- */

const SCHOOL_NAME = 'Bright Future Secondary School';
const SCHOOL_URL = process.env.CLIENT_URL || 'http://localhost:3000';

function wrapper(title, inner) {
  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f4f6fb;padding:24px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.06)">
    <div style="background:linear-gradient(120deg,#1d4ed8,#2563eb);color:#fff;padding:24px 28px">
      <div style="display:flex;align-items:center;gap:12px">
        <img src="${SCHOOL_URL}/school-logo.png" alt="" width="40" height="40"
             style="background:#fff;border-radius:8px;padding:4px" />
        <div>
          <div style="font-size:16px;font-weight:700">${SCHOOL_NAME}</div>
          <div style="font-size:12px;opacity:.85">${title}</div>
        </div>
      </div>
    </div>
    <div style="padding:24px 28px">${inner}</div>
    <div style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:11px;text-align:center">
      You're receiving this because you enabled email digests.
      <br/>Manage your preferences at
      <a href="${SCHOOL_URL}" style="color:#2563eb">${SCHOOL_URL}</a>.
    </div>
  </div>
</body></html>`;
}

function itemRow(label, title, meta, url) {
  return `
    <a href="${url}" style="display:block;padding:12px 14px;border:1px solid #e5e9f2;border-radius:10px;margin-bottom:8px;text-decoration:none;color:inherit">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;font-weight:600">${label}</div>
      <div style="font-size:14px;font-weight:600;color:#0b1220;margin:4px 0">${title}</div>
      <div style="font-size:12px;color:#64748b">${meta}</div>
    </a>`;
}

/* ---------------- Student daily digest ---------------- */
function studentDigestEmail({ name, dueSoon, dueThisWeek, announcements }) {
  const dueSoonHtml = dueSoon.length
    ? dueSoon.map((a) => itemRow(
        a.type === 'quiz' ? 'Quiz due tomorrow' : 'Assignment due tomorrow',
        a.title,
        `${a.subject} · Due ${a.dueDate}`,
        `${SCHOOL_URL}/student/${a.type === 'quiz' ? 'lms' : 'assignments'}`
      )).join('')
    : '<p style="color:#64748b;font-size:13px">Nothing urgent — you\'re caught up! 🎉</p>';

  const weekHtml = dueThisWeek.length
    ? dueThisWeek.map((a) => itemRow(
        a.type === 'quiz' ? 'Quiz' : 'Assignment',
        a.title,
        `${a.subject} · Due ${a.dueDate}`,
        `${SCHOOL_URL}/student/${a.type === 'quiz' ? 'lms' : 'assignments'}`
      )).join('')
    : '<p style="color:#64748b;font-size:13px">Nothing due this week.</p>';

  const annHtml = announcements.length
    ? announcements.map((a) =>
        `<div style="padding:8px 0;border-bottom:1px solid #e5e9f2">
           <div style="font-size:13px;font-weight:600;color:#0b1220">${a.title}</div>
           <div style="font-size:12px;color:#64748b;margin-top:2px">${a.body.slice(0, 100)}${a.body.length > 100 ? '…' : ''}</div>
         </div>`
      ).join('')
    : '<p style="color:#64748b;font-size:13px">No new announcements.</p>';

  const inner = `
    <h1 style="font-size:20px;margin:0 0 6px;color:#0b1220">Good morning, ${escapeHtml(name.split(' ')[0])} 👋</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px">Here's your day at a glance.</p>

    <h2 style="font-size:14px;color:#dc2626;margin:0 0 10px;text-transform:uppercase;letter-spacing:.5px">⚡ Due tomorrow (${dueSoon.length})</h2>
    ${dueSoonHtml}

    <h2 style="font-size:14px;color:#2563eb;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px">📅 This week (${dueThisWeek.length})</h2>
    ${weekHtml}

    <h2 style="font-size:14px;color:#7c3aed;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px">📣 Announcements</h2>
    ${annHtml}

    <div style="margin-top:28px">
      <a href="${SCHOOL_URL}/student/home" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:13px">
        Open dashboard →
      </a>
    </div>
  `;
  return { subject: `📚 Your daily digest — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`, html: wrapper('Daily digest', inner) };
}

/* ---------------- Parent weekly digest ---------------- */
function parentDigestEmail({ name, children }) {
  const childCards = children.map((c) => `
    <div style="border:1px solid #e5e9f2;border-radius:12px;padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:#0b1220">${escapeHtml(c.name)}</div>
          <div style="font-size:12px;color:#64748b">${c.className} · ${c.admissionNo}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:800;color:#16a34a">${c.average}%</div>
          <div style="font-size:11px;color:#64748b">latest average</div>
        </div>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr>
          <td style="padding:4px 0;color:#64748b">Attendance</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;color:#0b1220">${c.attendance}%</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b">Outstanding fees</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;color:${c.outstanding > 0 ? '#dc2626' : '#16a34a'}">
            ₦${Number(c.outstanding || 0).toLocaleString('en-NG')}
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b">Missing assignments</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;color:${c.missing > 0 ? '#f59e0b' : '#16a34a'}">
            ${c.missing}
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  const inner = `
    <h1 style="font-size:20px;margin:0 0 6px;color:#0b1220">Hi ${escapeHtml(name.split(' ')[0])},</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 20px">
      Weekly recap for ${children.length === 1 ? 'your child' : 'your children'}:
    </p>
    ${childCards}
    <div style="margin-top:24px">
      <a href="${SCHOOL_URL}/parent/home" style="display:inline-block;padding:12px 22px;background:#d97706;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:13px">
        Open parent dashboard →
      </a>
    </div>
  `;

  return {
    subject: `📊 Weekly recap — ${children.length} child${children.length === 1 ? '' : 'ren'}`,
    html: wrapper('Weekly digest', inner),
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = { studentDigestEmail, parentDigestEmail };