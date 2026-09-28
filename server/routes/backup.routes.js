const router = require('express').Router();
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');

router.use(protect, allow('admin'));

/* Tables we allow the admin to export — whitelist for safety */
const EXPORTABLE_TABLES = [
  'users', 'admins', 'teachers', 'students', 'parents', 'classes',
  'results', 'fees', 'attendance', 'timetables', 'quizzes', 'quiz_submissions',
  'notes', 'note_comments', 'assignments', 'assignment_submissions',
  'discussion_comments', 'class_sessions', 'announcements', 'notifications',
  'conversations', 'messages', 'password_resets', 'calendar_events',
  'sms_log', 'teacher_assignments', 'question_bank', 'lesson_plans',
  'meetings', 'behaviour_reports', 'push_subscriptions',
  'notification_prefs', 'reminder_log',
];

/* Tables we never include in the full backup (security) */
const SENSITIVE_TABLES = new Set([
  'password_resets',
]);

/* ============================================================
   GET /api/backup/tables — list available tables + row counts
   ============================================================ */
router.get('/tables', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT table_name AS name, table_rows AS approxRows
       FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_name`,
      [process.env.DB_NAME]
    );

    res.json(
      rows
        .filter((r) => EXPORTABLE_TABLES.includes(r.name))
        .map((r) => ({
          name: r.name,
          approxRows: Number(r.approxRows || 0),
          sensitive: SENSITIVE_TABLES.has(r.name),
        }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/backup/table/:name — export a single table as CSV
   ============================================================ */
router.get('/table/:name', async (req, res) => {
  const name = req.params.name;
  if (!EXPORTABLE_TABLES.includes(name)) {
    return res.status(400).json({ message: 'Table not exportable' });
  }

  try {
    const [rows] = await pool.query(`SELECT * FROM \`${name}\``);

    if (!rows.length) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name}-${new Date().toISOString().slice(0,10)}.csv"`
      );
      return res.send('\uFEFF');
    }

    const headers = Object.keys(rows[0]);
    const csvEscape = (v) => {
      if (v === null || v === undefined) return '';
      const s = v instanceof Date ? v.toISOString() : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [headers.map(csvEscape).join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name}-${new Date().toISOString().slice(0,10)}.csv"`
    );
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error('CSV export failed:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ============================================================
   GET /api/backup/full — full JSON snapshot
   Query param: ?includeSensitive=true to include password_resets
   ============================================================ */
router.get('/full', async (req, res) => {
  const includeSensitive = req.query.includeSensitive === 'true';
  const startedAt = Date.now();

  try {
    const dump = {
      meta: {
        generatedAt: new Date().toISOString(),
        database: process.env.DB_NAME,
        tables: [],
        totalRows: 0,
        note: includeSensitive
          ? 'Includes password_resets — treat with care.'
          : 'Password reset tokens are excluded.',
      },
      data: {},
    };

    for (const table of EXPORTABLE_TABLES) {
      if (!includeSensitive && SENSITIVE_TABLES.has(table)) continue;

      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      dump.data[table] = rows;
      dump.meta.tables.push({ name: table, rows: rows.length });
      dump.meta.totalRows += rows.length;
    }

    dump.meta.durationMs = Date.now() - startedAt;

    const filename = `bright-future-backup-${new Date()
      .toISOString().replace(/[:.]/g, '-')
      .slice(0, 19)}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    console.error('Full backup failed:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;