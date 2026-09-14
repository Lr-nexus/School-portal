const pool = require('../db');

async function notify({ userId, type, title, body, link }) {
  await pool.execute(
    'INSERT INTO notifications (user_id, type, title, body, link, `read`, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
    [userId, type, title, body, link || null]
  );
}

async function notifyClassStudents(className, payload) {
  const [students] = await pool.execute(
    'SELECT user_id FROM students WHERE class_name = ? AND user_id IS NOT NULL',
    [className]
  );
  for (const s of students) await notify({ ...payload, userId: s.user_id });
}

async function notifyAllUsers(payload) {
  const [users] = await pool.execute('SELECT id FROM users');
  for (const u of users) await notify({ ...payload, userId: u.id });
}

module.exports = { notify, notifyClassStudents, notifyAllUsers };