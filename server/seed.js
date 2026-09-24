require('dotenv').config();
const pool = require('./db');

async function seed() {
  console.log('🌱 Seeding database…\n');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
      'sms_log', 'calendar_events', 'password_resets',
      'messages', 'conversations',
      'notifications', 'announcements', 'class_sessions',
      'discussion_comments', 'assignment_submissions', 'assignments',
      'note_comments', 'notes',
      'quiz_submissions', 'quizzes',
      'attendance', 'timetables',
      'fees', 'results', 'classes',
      'parents', 'admins', 'teachers', 'students', 'users'
    ];
    for (const t of tables) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    /* ---------- ADMIN ---------- */
    const [aU] = await conn.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('Grace Ade', 'admin@school.com', 'admin123', 'admin')`
    );
    await conn.query(
      `INSERT INTO admins (user_id, name, title, email, phone, office, joined)
       VALUES (?, 'Grace Ade', 'Principal', 'admin@school.com',
               '0809 777 8888', 'Principal Office', CURDATE())`,
      [aU.insertId]
    );

    /* ---------- TEACHER ---------- */
    const [tU] = await conn.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('Adewale Johnson', 'teacher@school.com', 'teacher123', 'teacher')`
    );
    const [tRes] = await conn.query(
      `INSERT INTO teachers (user_id, name, staff_no, email, phone, subjects,
                             form_class, qualification, address, joined)
       VALUES (?, 'Adewale Johnson', 'TCH/001', 'teacher@school.com',
               '0802 111 0001', ?, 'JSS 2A', 'B.Sc Mathematics', 'Lagos', CURDATE())`,
      [tU.insertId, JSON.stringify(['Mathematics', 'Further Mathematics'])]
    );
    const teacherId = tRes.insertId;

    /* ---------- CLASS ---------- */
    await conn.query(
      `INSERT INTO classes (name, teacher_id, subjects, schedule)
       VALUES ('JSS 2A', ?, ?, ?)`,
      [
        teacherId,
        JSON.stringify(['Mathematics', 'English Language', 'Basic Science']),
        JSON.stringify([]),
      ]
    );

    /* ---------- STUDENTS ---------- */
    const studentDefs = [
      ['Ada Obi',      'ada@school.com',    'STD/2025/001', 'Female', 'Mr. Peter Obi',  '0803 111 2222'],
      ['Chidi Eze',    'chidi@school.com',  'STD/2025/002', 'Male',   'Mrs. Ngozi Eze', '0803 333 4444'],
      ['Fatima Bello', 'fatima@school.com', 'STD/2025/003', 'Female', 'Alhaji Bello',   '0803 555 6666'],
    ];

    const studentIds = [];
    for (const [name, email, adm, gender, gName, gPhone] of studentDefs) {
      const [sU] = await conn.query(
        `INSERT INTO users (name, email, password, role)
         VALUES (?, ?, 'changeme123', 'student')`,
        [name, email]
      );
      const [sRes] = await conn.query(
        `INSERT INTO students
          (user_id, name, admission_no, class_name, gender,
           guardian_name, guardian_phone, address, email, house)
         VALUES (?, ?, ?, 'JSS 2A', ?, ?, ?, '12 Allen Avenue, Ikeja', ?, 'Red')`,
        [sU.insertId, name, adm, gender, gName, gPhone, email]
      );
      studentIds.push(sRes.insertId);
    }

        /* ---------- PARENT (linked to first student) ---------- */
    const [pU] = await conn.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ('Mr. Peter Obi', 'parent@school.com', 'parent123', 'parent')`
    );
    const [pRes] = await conn.query(
      `INSERT INTO parents (user_id, name, email, phone, relationship, address)
       VALUES (?, 'Mr. Peter Obi', 'parent@school.com',
               '0803 111 2222', 'Father', '12 Allen Avenue, Ikeja')`,
      [pU.insertId]
    );
    await conn.query(
      'UPDATE students SET parent_id = ? WHERE id = ?',
      [pRes.insertId, studentIds[0]]
    );

    /* ---------- RESULTS ---------- */
    const subjects = ['Mathematics', 'English Language', 'Basic Science'];
    const session = '2024/2025';
    const term = 'First Term';

    for (const sid of studentIds) {
      for (const subj of subjects) {
        const ca = Math.floor(Math.random() * 15) + 15;   // 15–29
        const exam = Math.floor(Math.random() * 30) + 40; // 40–69
        await conn.query(
          `INSERT INTO results (student_id, session, term, subject, ca, exam)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [sid, session, term, subj, ca, exam]
        );
      }
    }

    /* ---------- FEES ---------- */
    const items = JSON.stringify([
      { name: 'Tuition Fee', amount: 45000 },
      { name: 'Development Levy', amount: 5000 },
      { name: 'Books & Materials', amount: 7500 },
    ]);
    const reference = `PUB-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-0001`;
    for (const sid of studentIds) {
      await conn.query(
        `INSERT INTO fees
          (student_id, session, term, items, amount_paid, date, reference, method)
         VALUES (?, ?, ?, ?, 0, CURDATE(), ?, '-')`,
        [sid, session, term, items, reference]
      );
    }

    /* ---------- ANNOUNCEMENT ---------- */
    await conn.query(
      `INSERT INTO announcements (title, body, date, audience, category)
       VALUES ('Welcome Back', 'School resumes Monday 6th January.', CURDATE(), 'all', 'General')`
    );

    await conn.commit();

    console.log('✅ Seed complete!\n');
    console.log('   Admin:   admin@school.com / admin123');
    console.log('   Teacher: teacher@school.com / teacher123');
    console.log('   Student: ada@school.com / changeme123');
    console.log('   Parent:  parent@school.com / parent123');
    console.log('\n   Class JSS 2A has 3 students, results, and one fee batch.\n');
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