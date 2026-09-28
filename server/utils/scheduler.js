/* ------------------------------------------------------------------
   Lightweight in-process scheduler.
   Runs deadline reminders every 30 min and digests every hour,
   but dedupes so each item is only ever sent once per user.
------------------------------------------------------------------- */

const pool = require('../db');
const { notify } = require('./notify');
const { sendPushToUser } = require('./push');
const { sendEmail } = require('./email');
const { studentDigestEmail, parentDigestEmail } = require('./digestTemplates');

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let started = false;
let timer = null;

/* ------------------------------------------------------------------
   Reminder helper — records a send so we never duplicate
------------------------------------------------------------------ */
async function alreadySent(kind, entityType, entityId, userId, channel) {
  const [rows] = await pool.execute(
    `SELECT id FROM reminder_log
     WHERE kind = ? AND entity_type = ? AND entity_id = ? AND user_id = ? AND channel = ?`,
    [kind, entityType, entityId, userId, channel]
  );
  return rows.length > 0;
}

async function markSent(kind, entityType, entityId, userId, channel) {
  try {
    await pool.execute(
      `INSERT IGNORE INTO reminder_log (kind, entity_type, entity_id, user_id, channel)
       VALUES (?, ?, ?, ?, ?)`,
      [kind, entityType, entityId, userId, channel]
    );
  } catch (e) {
    console.error('markSent failed:', e.message);
  }
}

/* ------------------------------------------------------------------
   JOB 1 — Deadline reminders
   Finds items due in the next ~24h and reminds every student in the
   target class who hasn't submitted yet.
------------------------------------------------------------------ */
async function sendDeadlineReminders() {
  const started = Date.now();
  let totalSent = 0;

  try {
    /* ---------- Assignments due in next 24h ---------- */
    const [assignments] = await pool.execute(`
      SELECT a.id, a.title, a.subject, a.class_name, a.due_date,
             t.user_id AS teacher_user_id, t.name AS teacher_name
      FROM assignments a
      JOIN teachers t ON t.id = a.teacher_id
      WHERE a.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);

    for (const a of assignments) {
      const [students] = await pool.execute(
        `SELECT s.id, s.name, s.user_id
         FROM students s
         WHERE s.class_name = ?
           AND s.user_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM assignment_submissions sub
             WHERE sub.assignment_id = ? AND sub.student_id = s.id
           )`,
        [a.class_name, a.id]
      );

      for (const s of students) {
        const sentInApp = await alreadySent('deadline_24h', 'assignment', a.id, s.user_id, 'in_app');
        if (!sentInApp) {
          await notify({
            userId: s.user_id,
            type: 'deadline',
            title: '⏰ Assignment due tomorrow',
            body: `"${a.title}" (${a.subject}) is due tomorrow. Don't forget to submit!`,
            link: '/student/assignments',
          });
          await markSent('deadline_24h', 'assignment', a.id, s.user_id, 'in_app');
          totalSent++;
        }

        const sentPush = await alreadySent('deadline_24h', 'assignment', a.id, s.user_id, 'push');
        if (!sentPush) {
          await sendPushToUser(s.user_id, {
            title: '⏰ Assignment due tomorrow',
            body: `"${a.title}" — submit before the deadline`,
            url: '/student/assignments',
            tag: `assign-${a.id}`,
          });
          await markSent('deadline_24h', 'assignment', a.id, s.user_id, 'push');
        }
      }
    }

    /* ---------- Quizzes due in next 24h ---------- */
    const [quizzes] = await pool.execute(`
      SELECT q.id, q.title, q.subject, q.class_name, q.due_date
      FROM quizzes q
      WHERE q.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `);

    for (const q of quizzes) {
      const [students] = await pool.execute(
        `SELECT s.id, s.name, s.user_id
         FROM students s
         WHERE s.class_name = ?
           AND s.user_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM quiz_submissions qs
             WHERE qs.quiz_id = ? AND qs.student_id = s.id
           )`,
        [q.class_name, q.id]
      );

      for (const s of students) {
        const sentInApp = await alreadySent('deadline_24h', 'quiz', q.id, s.user_id, 'in_app');
        if (!sentInApp) {
          await notify({
            userId: s.user_id,
            type: 'deadline',
            title: '⏰ Quiz due tomorrow',
            body: `"${q.title}" (${q.subject}) closes tomorrow.`,
            link: '/student/lms',
          });
          await markSent('deadline_24h', 'quiz', q.id, s.user_id, 'in_app');
          totalSent++;
        }

        const sentPush = await alreadySent('deadline_24h', 'quiz', q.id, s.user_id, 'push');
        if (!sentPush) {
          await sendPushToUser(s.user_id, {
            title: '⏰ Quiz due tomorrow',
            body: `"${q.title}" closes tomorrow`,
            url: '/student/lms',
            tag: `quiz-${q.id}`,
          });
          await markSent('deadline_24h', 'quiz', q.id, s.user_id, 'push');
        }
      }
    }

    console.log(`⏰ Deadline reminders: ${totalSent} in-app sent (${Date.now() - started}ms)`);
  } catch (err) {
    console.error('Deadline reminders failed:', err.message);
  }
}

/* ------------------------------------------------------------------
   JOB 2 — Email digests (student daily, parent weekly)
------------------------------------------------------------------ */
async function sendDigests() {
  const hour = new Date().getHours();

  /* ---------- Student daily digest at 7am ---------- */
  if (hour === 7) {
    try {
      const [students] = await pool.execute(`
        SELECT s.id, s.name, s.class_name, s.email, s.user_id,
               u.email AS user_email
        FROM students s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN notification_prefs np ON np.user_id = u.id
        WHERE s.user_id IS NOT NULL
          AND s.email IS NOT NULL
          AND s.email != ''
          AND COALESCE(np.email_digest_enabled, 1) = 1
          AND COALESCE(np.digest_frequency, 'daily') = 'daily'
      `);

      for (const s of students) {
        const already = await alreadySent(
          `daily_${new Date().toISOString().slice(0, 10)}`,
          'student', s.id, s.user_id, 'email'
        );
        if (already) continue;

        /* Due tomorrow */
        const [dueSoon] = await pool.execute(`
          SELECT 'assignment' AS type, a.id, a.title, a.subject, a.due_date
          FROM assignments a
          WHERE a.class_name = ?
            AND a.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND NOT EXISTS (
              SELECT 1 FROM assignment_submissions sub
              WHERE sub.assignment_id = a.id AND sub.student_id = ?
            )
          UNION ALL
          SELECT 'quiz' AS type, q.id, q.title, q.subject, q.due_date
          FROM quizzes q
          WHERE q.class_name = ?
            AND q.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND NOT EXISTS (
              SELECT 1 FROM quiz_submissions qs
              WHERE qs.quiz_id = q.id AND qs.student_id = ?
            )
        `, [s.class_name, s.id, s.class_name, s.id]);

        /* Due this week (2–7 days) */
        const [dueThisWeek] = await pool.execute(`
          SELECT 'assignment' AS type, a.id, a.title, a.subject, a.due_date
          FROM assignments a
          WHERE a.class_name = ?
            AND a.due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 2 DAY)
                               AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
          UNION ALL
          SELECT 'quiz' AS type, q.id, q.title, q.subject, q.due_date
          FROM quizzes q
          WHERE q.class_name = ?
            AND q.due_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 2 DAY)
                               AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `, [s.class_name, s.class_name]);

        /* Recent announcements */
        const [announcements] = await pool.execute(
          `SELECT title, body FROM announcements
           WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           ORDER BY date DESC LIMIT 3`
        );

        /* Only send if there's actually something to say */
        if (!dueSoon.length && !dueThisWeek.length && !announcements.length) {
          await markSent(
            `daily_${new Date().toISOString().slice(0, 10)}`,
            'student', s.id, s.user_id, 'email'
          );
          continue;
        }

        const tpl = studentDigestEmail({
          name: s.name,
          dueSoon,
          dueThisWeek,
          announcements,
        });

        await sendEmail({
          to: s.email,
          subject: tpl.subject,
          html: tpl.html,
        });

        await markSent(
          `daily_${new Date().toISOString().slice(0, 10)}`,
          'student', s.id, s.user_id, 'email'
        );
      }
    } catch (err) {
      console.error('Student digest failed:', err.message);
    }
  }

  /* ---------- Parent weekly digest on Monday at 8am ---------- */
  const day = new Date().getDay(); // 0 = Sunday, 1 = Monday
  if (day === 1 && hour === 8) {
    try {
      const [parents] = await pool.execute(`
        SELECT p.id, p.name, p.user_id, u.email AS user_email
        FROM parents p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN notification_prefs np ON np.user_id = u.id
        WHERE u.email IS NOT NULL AND u.email != ''
          AND COALESCE(np.email_digest_enabled, 1) = 1
          AND COALESCE(np.digest_frequency, 'daily') != 'off'
      `);

      const weekKey = new Date().toISOString().slice(0, 10);

      for (const p of parents) {
        const already = await alreadySent(`weekly_${weekKey}`, 'parent', p.id, p.user_id, 'email');
        if (already) continue;

        const [children] = await pool.execute(
          'SELECT * FROM students WHERE parent_id = ?',
          [p.id]
        );

        if (!children.length) continue;

        const childSummaries = [];
        for (const child of children) {
          /* Latest average */
          const [latest] = await pool.execute(
            `SELECT session, term FROM results
             WHERE student_id = ?
             ORDER BY session DESC, term DESC LIMIT 1`,
            [child.id]
          );
          let average = 0;
          if (latest.length) {
            const [rows] = await pool.execute(
              `SELECT ca, exam FROM results
               WHERE student_id = ? AND session = ? AND term = ?`,
              [child.id, latest[0].session, latest[0].term]
            );
            if (rows.length) {
              const totals = rows.map((r) => Number(r.ca) + Number(r.exam));
              average = Math.round(totals.reduce((s, x) => s + x, 0) / totals.length);
            }
          }

          /* Attendance */
          const [[att]] = await pool.execute(
            `SELECT SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
                    COUNT(*) AS total
             FROM attendance WHERE student_id = ?`,
            [child.id]
          );
          const attendanceRate = att.total
            ? Math.round((Number(att.present) / Number(att.total)) * 100)
            : 0;

          /* Outstanding fees */
          const [fees] = await pool.execute(
            'SELECT items, amount_paid FROM fees WHERE student_id = ?',
            [child.id]
          );
          let outstanding = 0;
          fees.forEach((f) => {
            const items = JSON.parse(f.items || '[]');
            const total = items.reduce((s, i) => s + Number(i.amount), 0);
            outstanding += Math.max(total - parseFloat(f.amount_paid || 0), 0);
          });

          /* Missing assignments */
          const [[miss]] = await pool.execute(
            `SELECT COUNT(*) AS n FROM assignments a
             WHERE a.class_name = ?
               AND NOT EXISTS (
                 SELECT 1 FROM assignment_submissions sub
                 WHERE sub.assignment_id = a.id AND sub.student_id = ?
               )`,
            [child.class_name, child.id]
          );

          childSummaries.push({
            name: child.name,
            className: child.class_name,
            admissionNo: child.admission_no,
            average,
            attendance: attendanceRate,
            outstanding,
            missing: Number(miss.n),
          });
        }

        const tpl = parentDigestEmail({ name: p.name, children: childSummaries });
        await sendEmail({ to: p.user_email, subject: tpl.subject, html: tpl.html });

        await markSent(`weekly_${weekKey}`, 'parent', p.id, p.user_id, 'email');
      }
    } catch (err) {
      console.error('Parent digest failed:', err.message);
    }
  }
}

/* ------------------------------------------------------------------
   Public API
------------------------------------------------------------------ */
function start() {
  if (started) return;
  started = true;

  console.log('⏱  Scheduler started — checking every 30 minutes');

  /* First run after 60s, then every 30 min */
  setTimeout(() => {
    runAll();
    timer = setInterval(runAll, CHECK_INTERVAL_MS);
  }, 60_000);
}

function runAll() {
  Promise.all([
    sendDeadlineReminders(),
    sendDigests(),
  ]).catch((e) => console.error('Scheduler run failed:', e.message));
}

function stop() {
  if (timer) clearInterval(timer);
  started = false;
}

/* Manually trigger — used by the admin debug endpoint */
async function runNow() {
  await sendDeadlineReminders();
  await sendDigests();
  return { ok: true };
}

module.exports = { start, stop, runNow };