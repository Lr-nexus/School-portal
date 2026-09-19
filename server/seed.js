const pool = require('./db');

async function seed() {
  console.log('Seeding database...');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'notifications', 'announcements', 'class_sessions',
      'assignment_submissions', 'assignments',
      'note_comments', 'notes',
      'quiz_submissions', 'quizzes',
      'fees', 'results', 'classes',
      'admins', 'teachers', 'students', 'users'
    ];
    for (const t of tables) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // ---- ONLY the admin account ----
    // Every other user (teachers, students) is created by the admin
    // through the enrollment forms.
    const [uResult] = await conn.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('Grace Ade', 'admin@school.com', 'admin123', 'admin')`
    );
    const adminUserId = uResult.insertId;

    await conn.query(
      `INSERT INTO admins (user_id, name, title, email, phone, office, joined)
       VALUES (?, 'Grace Ade', 'Principal', 'admin@school.com',
               '0809 777 8888', 'Principal’s Office, Admin Block', CURDATE())`,
      [adminUserId]
    );

    await conn.commit();
    console.log('\n✅ Admin account created.\n');
    console.log('   Login: admin@school.com / admin123');
    console.log('   Use the admin portal to enroll teachers and students.\n');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();