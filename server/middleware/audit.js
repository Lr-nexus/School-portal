/* ------------------------------------------------------------------
   Audit logger — records every mutating request to audit_log.
   Only fires for authenticated users with role admin or teacher.

   Mounted globally so nothing slips through, but light-touch:
   - Skips GET/OPTIONS/HEAD
   - Skips /api/auth/* (login, password reset)
   - Skips /api/notifications/admin/run-scheduler (would log itself)
   ------------------------------------------------------------------ */

const pool = require('../db');

const EXCLUDED_PATHS = [
  /^\/api\/auth\//,
  /^\/api\/notifications\/admin\/run-scheduler/,
];

function shouldLog(req) {
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) return false;
  if (EXCLUDED_PATHS.some((re) => re.test(req.path))) return false;
  return true;
}

/* Turn "/api/admin/students/42" → { resource: 'students', entityId: 42 } */
function parseResource(path) {
  const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  if (!parts.length) return { resource: null, entityId: null };

  // Skip role prefixes: admin, teachers, students, parents, ...
  const known = new Set([
    'admin', 'teachers', 'students', 'parents', 'notes', 'assignments',
    'lms', 'classroom', 'attendance', 'timetable', 'calendar', 'reports',
    'analytics', 'announcements', 'behaviour', 'financial', 'backup',
    'bulk', 'audit', 'messages', 'discussions', 'parents', 'reviews',
    'uploads', 'sms', 'push', 'notifications', 'search',
  ]);

  const idx = parts.findIndex((p) => known.has(p));
  const resource = idx >= 0 ? parts[idx] : parts[0];

  // Find the first numeric segment after the resource
  let entityId = null;
  for (let i = (idx >= 0 ? idx + 1 : 1); i < parts.length; i++) {
    const n = Number(parts[i]);
    if (Number.isInteger(n) && n > 0) { entityId = n; break; }
  }

  return { resource, entityId };
}

/* Summarize the body — strip passwords, truncate long fields */
function summarizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const copy = { ...body };
  delete copy.password;
  delete copy.currentPassword;
  delete copy.newPassword;
  delete copy.parentPassword;
  delete copy.confirmPassword;

  // Truncate any string values over 200 chars
  for (const k of Object.keys(copy)) {
    if (typeof copy[k] === 'string' && copy[k].length > 200) {
      copy[k] = copy[k].slice(0, 200) + '…';
    }
  }

  // Remove large arrays
  for (const k of Object.keys(copy)) {
    if (Array.isArray(copy[k]) && copy[k].length > 10) {
      copy[k] = `[${copy[k].length} items]`;
    }
  }

  try {
    return JSON.stringify(copy).slice(0, 2000);
  } catch {
    return null;
  }
}

async function writeLog(req, status) {
  try {
    const { resource, entityId } = parseResource(req.path);
    const body = summarizeBody(req.body);

    await pool.execute(
      `INSERT INTO audit_log
        (user_id, user_name, user_role, method, path, resource,
         entity_id, status, ip, user_agent, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        req.user?.name || null,
        req.user?.role || null,
        req.method,
        req.originalUrl.slice(0, 500),
        resource,
        entityId,
        status,
        String(req.ip || '').slice(0, 50),
        String(req.headers['user-agent'] || '').slice(0, 255),
        body,
      ]
    );
  } catch (err) {
    console.error('audit write failed:', err.message);
  }
}

module.exports = function auditMiddleware(req, res, next) {
  if (!shouldLog(req)) return next();

  // Capture the status when the response is finished
  res.on('finish', () => {
    // Only log admins/teachers, and only if they got a non-auth error
    if (!req.user) return;
    if (!['admin', 'teacher'].includes(req.user.role)) return;
    if (res.statusCode >= 500) return; // server errors get their own trail

    writeLog(req, res.statusCode).catch(() => {});
  });

  next();
};