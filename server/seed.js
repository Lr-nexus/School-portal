require('dotenv').config();
const pool = require('./db');

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

/* Returns the full [rows, fields] tuple from mysql2, so callers can do
   const [rows] = await q('SELECT…')
   const [result] = await q('INSERT…')  */
async function q(sql, params = []) {
  return pool.query(sql, params);
}

async function step(name, fn) {
  process.stdout.write(`   → ${name} `);
  try {
    const r = await fn();
    console.log('✓');
    return r;
  } catch (err) {
    console.log('✗');
    console.error(`      ${err.message}`);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
const SESSION = '2024/2025';
const TERMS = ['First Term', 'Second Term'];

const CLASS_DEFS = [
  { name: 'JSS 1A', teacher: 'TCH/002' },
  { name: 'JSS 1B', teacher: 'TCH/003' },
  { name: 'JSS 2A', teacher: 'TCH/001' },
  { name: 'JSS 2B', teacher: 'TCH/004' },
  { name: 'JSS 3A', teacher: 'TCH/005' },
  { name: 'JSS 3B', teacher: 'TCH/006' },
];

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies',
];

const STUDENT_FIRST = [
  'Ada', 'Chidi', 'Fatima', 'Emeka', 'Ngozi', 'Tunde', 'Aisha', 'Kelechi',
  'Blessing', 'Ibrahim', 'Chiamaka', 'Segun', 'Zainab', 'Obinna', 'Halima',
  'Yusuf', 'Amara', 'Bola', 'Ifeoma', 'Musa', 'Kemi', 'David', 'Grace', 'Samuel',
];
const STUDENT_LAST = [
  'Obi', 'Eze', 'Bello', 'Adeyemi', 'Nwosu',
  'Okonkwo', 'Ibrahim', 'Okafor', 'Yusuf', 'Adebayo',
];

/* ================================================================== */
/* Main                                                                */
/* ================================================================== */
async function seed() {
  console.log('🌱 Seeding database…\n');
  const startedAt = Date.now();

  try {
    /* ================= 1. Truncate ================= */
    await step('Truncating tables', async () => {
      await q('SET FOREIGN_KEY_CHECKS = 0');
      const tables = [
        'sms_log', 'calendar_events', 'password_resets',
        'messages', 'conversations',
        'notifications', 'announcements', 'class_sessions',
        'discussion_comments', 'assignment_submissions', 'assignments',
        'note_comments', 'notes',
        'quiz_submissions', 'quizzes',
        'attendance', 'timetables',
        'fees', 'results', 'classes',
        'teacher_assignments', 'parents', 'admins', 'teachers',
        'students', 'users',
      ];
      for (const t of tables) await q(`TRUNCATE TABLE \`${t}\``);
      await q('SET FOREIGN_KEY_CHECKS = 1');
    });

    /* ================= 2. Admin ================= */
    const adminUserId = await step('Creating admin', async () => {
      const [u] = await q(
        `INSERT INTO users (name, email, password, role)
         VALUES ('Grace Ade', 'admin@school.com', 'admin123', 'admin')`
      );
      await q(
        `INSERT INTO admins (user_id, name, title, email, phone, office, joined)
         VALUES (?, 'Grace Ade', 'Principal', 'admin@school.com',
                 '0809 777 8888', 'Principal Office', CURDATE())`,
        [u.insertId]
      );
      return u.insertId;
    });

    /* ================= 3. Teachers ================= */
    const teachers = await step('Creating 8 teachers', async () => {
      const defs = [
        { name: 'Adewale Johnson', email: 'teacher@school.com', staff: 'TCH/001',
          subjects: ['Mathematics', 'Further Mathematics'], type: 'class_teacher', formClass: 'JSS 2A' },
        { name: 'Funmilayo Bello', email: 'funmi@school.com', staff: 'TCH/002',
          subjects: ['English Language', 'Literature'], type: 'class_teacher', formClass: 'JSS 1A' },
        { name: 'Musa Ibrahim', email: 'musa@school.com', staff: 'TCH/003',
          subjects: ['Basic Science'], type: 'class_teacher', formClass: 'JSS 1B' },
        { name: 'Ngozi Okafor', email: 'ngozi@school.com', staff: 'TCH/004',
          subjects: ['Social Studies'], type: 'class_teacher', formClass: 'JSS 2B' },
        { name: 'Segun Adeyemi', email: 'segun@school.com', staff: 'TCH/005',
          subjects: ['Computer Studies'], type: 'class_teacher', formClass: 'JSS 3A' },
        { name: 'Halima Yusuf', email: 'halima@school.com', staff: 'TCH/006',
          subjects: ['Mathematics'], type: 'class_teacher', formClass: 'JSS 3B' },
        { name: 'Emeka Nwosu', email: 'emeka@school.com', staff: 'TCH/007',
          subjects: ['English Language'], type: 'subject_teacher', formClass: '',
          assignments: [
            { className: 'JSS 2A', subject: 'English Language' },
            { className: 'JSS 2B', subject: 'English Language' },
            { className: 'JSS 3A', subject: 'English Language' },
          ] },
        { name: 'Blessing Obi', email: 'blessing@school.com', staff: 'TCH/008',
          subjects: ['Basic Science', 'Computer Studies'], type: 'subject_teacher', formClass: '',
          assignments: [
            { className: 'JSS 1A', subject: 'Computer Studies' },
            { className: 'JSS 1B', subject: 'Computer Studies' },
            { className: 'JSS 3B', subject: 'Basic Science' },
          ] },
      ];

      const out = [];
      for (const t of defs) {
        const [u] = await q(
          `INSERT INTO users (name, email, password, role)
           VALUES (?, ?, 'teacher123', 'teacher')`,
          [t.name, t.email]
        );
        const [tr] = await q(
          `INSERT INTO teachers (user_id, name, staff_no, email, phone, subjects,
             form_class, qualification, address, joined, teacher_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'B.Sc / PGDE', '12 Learning Road, Ikeja', CURDATE(), ?)`,
          [
            u.insertId, t.name, t.staff, t.email,
            `080${rand(10000000, 99999999)}`,
            JSON.stringify(t.subjects),
            t.formClass || null,
            t.type,
          ]
        );
        out.push({ id: tr.insertId, ...t });
      }
      return out;
    });

    const teacherByStaff = Object.fromEntries(teachers.map((t) => [t.staff, t]));

    /* ================= 4. Classes ================= */
    await step(`Creating ${CLASS_DEFS.length} classes`, async () => {
      for (const c of CLASS_DEFS) {
        const t = teacherByStaff[c.teacher];
        await q(
          `INSERT INTO classes (name, teacher_id, subjects, schedule) VALUES (?, ?, ?, ?)`,
          [c.name, t.id, JSON.stringify(t.subjects), JSON.stringify([])]
        );
        for (const subj of t.subjects) {
          await q(
            `INSERT IGNORE INTO teacher_assignments (teacher_id, class_name, subject)
             VALUES (?, ?, ?)`,
            [t.id, c.name, subj]
          );
        }
      }
    });

    /* ================= 5. Subject-teacher assignments ================= */
    await step('Creating subject-teacher assignments', async () => {
      for (const t of teachers) {
        if (t.type === 'subject_teacher' && Array.isArray(t.assignments)) {
          for (const a of t.assignments) {
            await q(
              `INSERT IGNORE INTO teacher_assignments (teacher_id, class_name, subject)
               VALUES (?, ?, ?)`,
              [t.id, a.className, a.subject]
            );
          }
        }
      }
    });

    /* ================= 6. Students ================= */
    const studentRecords = await step('Creating students', async () => {
      const records = [];
      let admSeq = 1;
      const firstPool = [...STUDENT_FIRST];

      for (const cls of CLASS_DEFS) {
        const count = rand(3, 4);
        for (let i = 0; i < count; i++) {
          const first = firstPool.shift() || `Student${admSeq}`;
          const last = pick(STUDENT_LAST);
          const name = `${first} ${last}`;
          const email = `${first.toLowerCase()}.${last.toLowerCase()}${admSeq}@school.com`;
          const gender = pick(['Male', 'Female']);
          const guardianName = `${pick(['Mr.', 'Mrs.'])} ${last}`;
          const guardianPhone = `080${rand(10000000, 99999999)}`;
          const adm = `STD/${new Date().getFullYear()}/${String(admSeq).padStart(3, '0')}`;
          admSeq++;

          const [sU] = await q(
            `INSERT INTO users (name, email, password, role)
             VALUES (?, ?, 'changeme123', 'student')`,
            [name, email]
          );
          const [sRes] = await q(
            `INSERT INTO students
              (user_id, name, admission_no, class_name, gender, dob,
               guardian_name, guardian_phone, address, email, house)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sU.insertId, name, adm, cls.name, gender,
              `201${rand(0, 5)}-0${rand(1, 9)}-1${rand(0, 9)}`,
              guardianName, guardianPhone,
              `${rand(1, 40)} Allen Avenue, Ikeja`,
              email,
              pick(['Red', 'Blue', 'Green', 'Yellow']),
            ]
          );
          records.push({ id: sRes.insertId, userId: sU.insertId, name, email, className: cls.name });
        }
      }
      return records;
    });

    const studentIds = studentRecords.map((s) => s.id);

    /* First student becomes the demo login */
    await step('Setting up ada@school.com demo login', async () => {
      const first = studentRecords[0];
      await q('UPDATE users SET email = ? WHERE id = ?',
        ['ada@school.com', first.userId]);
      await q('UPDATE students SET email = ? WHERE id = ?',
        ['ada@school.com', first.id]);
      first.email = 'ada@school.com';
    });

    /* ================= 7. Parents ================= */
    await step('Creating 3 parents (parent@school.com etc.)', async () => {
      const defs = [
        { name: 'Mr. Peter Obi', email: 'parent@school.com', childIdx: 0, relationship: 'Father' },
        { name: 'Mrs. Ngozi Eze', email: 'parent2@school.com', childIdx: 1, relationship: 'Mother' },
        { name: 'Alhaji Bello', email: 'parent3@school.com', childIdx: 2, relationship: 'Guardian' },
      ];
      for (const p of defs) {
        const [pU] = await q(
          `INSERT INTO users (name, email, password, role)
           VALUES (?, ?, 'parent123', 'parent')`,
          [p.name, p.email]
        );
        const [pRes] = await q(
          `INSERT INTO parents (user_id, name, email, phone, relationship, address)
           VALUES (?, ?, ?, ?, ?, '12 Allen Avenue, Ikeja')`,
          [pU.insertId, p.name, p.email,
            `080${rand(10000000, 99999999)}`, p.relationship]
        );
        await q('UPDATE students SET parent_id = ? WHERE id = ?',
          [pRes.insertId, studentIds[p.childIdx]]);
      }
    });

    /* ================= 8. Results ================= */
    await step(`Creating ${studentIds.length * TERMS.length * SUBJECTS.length} result rows`, async () => {
      for (const sid of studentIds) {
        for (const term of TERMS) {
          for (const subj of SUBJECTS) {
            const ca = rand(15, 30);
            const exam = rand(35, 68);
            await q(
              `INSERT IGNORE INTO results (student_id, session, term, subject, ca, exam)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [sid, SESSION, term, subj, ca, exam]
            );
          }
        }
      }
    });

    /* ================= 9. Fees ================= */
    await step(`Creating fees for ${studentIds.length} students × ${TERMS.length} terms`, async () => {
      const items = JSON.stringify([
        { name: 'Tuition Fee', amount: 45000 },
        { name: 'Development Levy', amount: 5000 },
        { name: 'Books & Materials', amount: 7500 },
      ]);

      for (const term of TERMS) {
        const suffix = term === 'First Term' ? 'T1' : 'T2';
        const ref = `PUB-20242025-${suffix}`;
        for (const sid of studentIds) {
          const roll = Math.random();
          let paid = 0;
          let method = '-';
          if (roll < 0.6)       { paid = 57500;              method = 'Card'; }
          else if (roll < 0.85) { paid = rand(15000, 40000); method = 'Bank Transfer'; }

          await q(
            `INSERT INTO fees
              (student_id, session, term, items, amount_paid, date, reference, method)
             VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?)`,
            [sid, SESSION, term, items, paid, ref, method]
          );
        }
      }
    });

    /* ================= 10. Attendance ================= */
    await step('Creating 20 days of attendance per student', async () => {
      const days = [];
      const d = new Date();
      while (days.length < 20) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) days.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() - 1);
      }

      const [classRows] = await q('SELECT name, teacher_id FROM classes');
      const teacherByClass = Object.fromEntries(
        classRows.map((c) => [c.name, c.teacher_id])
      );

      for (const s of studentRecords) {
        const teacherId = teacherByClass[s.className] || null;
        for (const date of days) {
          const roll = Math.random();
          const status =
            roll < 0.85 ? 'Present' :
            roll < 0.92 ? 'Late' :
            roll < 0.97 ? 'Absent' : 'Excused';
          await q(
            `INSERT IGNORE INTO attendance
              (student_id, class_name, teacher_id, date, status, note)
             VALUES (?, ?, ?, ?, ?, '')`,
            [s.id, s.className, teacherId, date, status]
          );
        }
      }
    });

    /* ================= 11. Timetables ================= */
    await step('Creating timetables for all classes', async () => {
      const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const PERIODS = [
        { period: 1, start: '08:00', end: '08:45' },
        { period: 2, start: '08:45', end: '09:30' },
        { period: 3, start: '09:50', end: '10:35' },
        { period: 4, start: '10:35', end: '11:20' },
        { period: 5, start: '11:40', end: '12:25' },
        { period: 6, start: '12:25', end: '13:10' },
      ];

      const [classRows] = await q('SELECT name, teacher_id FROM classes');
      const [assignRows] = await q(
        'SELECT class_name, subject, teacher_id FROM teacher_assignments'
      );

      for (const c of classRows) {
        for (const day of DAYS) {
          for (let i = 0; i < PERIODS.length; i++) {
            const subject = SUBJECTS[i % SUBJECTS.length];
            const match = assignRows.find(
              (a) => a.class_name === c.name && a.subject === subject
            );
            const teacherId = match?.teacher_id || c.teacher_id;
            const p = PERIODS[i];
            await q(
              `INSERT INTO timetables
                (class_name, day, period, start_time, end_time, subject, teacher_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [c.name, day, p.period, p.start, p.end, subject, teacherId]
            );
          }
        }
      }
    });

    /* ================= 12. Quizzes + submissions ================= */
    await step('Creating quizzes with submissions', async () => {
      const titles = [
        'Algebra Basics Test', 'Reading Comprehension Quiz', 'Photosynthesis Quiz',
        'Map Reading Skills', 'Intro to Programming',
      ];
      const [classRows] = await q('SELECT name, teacher_id FROM classes');
      const [assignRows] = await q(
        'SELECT class_name, subject, teacher_id FROM teacher_assignments'
      );
      const [studentRows] = await q('SELECT id, class_name FROM students');

      for (const c of classRows) {
        for (let i = 0; i < 2; i++) {
          const subject = pick(SUBJECTS);
          const match = assignRows.find(
            (a) => a.class_name === c.name && a.subject === subject
          );
          const teacherId = match?.teacher_id || c.teacher_id;

          const questions = Array.from({ length: 5 }, (_, j) => ({
            id: j + 1,
            question: `Sample question ${j + 1} for ${subject}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            answer: rand(0, 3),
          }));

          const [qRes] = await q(
            `INSERT INTO quizzes
              (title, subject, class_name, teacher_id, duration, due_date, questions)
             VALUES (?, ?, ?, ?, 15, DATE_ADD(CURDATE(), INTERVAL 5 DAY), ?)`,
            [pick(titles), subject, c.name, teacherId, JSON.stringify(questions)]
          );

          const classStudents = studentRows.filter((s) => s.class_name === c.name);
          for (const st of classStudents) {
            if (Math.random() < 0.65) {
              await q(
                `INSERT INTO quiz_submissions (quiz_id, student_id, score, total, date)
                 VALUES (?, ?, ?, 5, CURDATE())`,
                [qRes.insertId, st.id, rand(1, 5)]
              );
            }
          }
        }
      }
    });

    /* ================= 13. Notes ================= */
    await step('Creating rich-text notes', async () => {
      const [classRows] = await q('SELECT name, teacher_id FROM classes');
      for (const c of classRows) {
        if (!c.teacher_id) continue;
        for (let i = 0; i < 2; i++) {
          const subject = pick(SUBJECTS);
          await q(
            `INSERT INTO notes
              (teacher_id, title, subject, class_name, description, type, content, uploaded_at)
             VALUES (?, ?, ?, ?, ?, 'richtext', ?, NOW())`,
            [
              c.teacher_id,
              `${subject} — Chapter ${i + 1}`,
              subject, c.name,
              `Detailed notes covering the first part of ${subject}.`,
              `<h2>${subject} — Chapter ${i + 1}</h2>
               <p>These notes introduce the key concepts of <strong>${subject}</strong>.</p>
               <ul><li>Concept 1</li><li>Concept 2</li><li>Concept 3</li></ul>
               <p>Read carefully and attempt the exercises at the end.</p>`,
            ]
          );
        }
      }
    });

    /* ================= 14. Assignments + submissions ================= */
    await step('Creating assignments with submissions', async () => {
      const [classRows] = await q('SELECT name, teacher_id FROM classes');
      const [assignRows] = await q(
        'SELECT class_name, subject, teacher_id FROM teacher_assignments'
      );
      const [studentRows] = await q('SELECT id, class_name FROM students');

      for (const c of classRows) {
        for (let i = 0; i < 2; i++) {
          const subject = pick(SUBJECTS);
          const match = assignRows.find(
            (a) => a.class_name === c.name && a.subject === subject
          );
          const teacherId = match?.teacher_id || c.teacher_id;

          const [aRes] = await q(
            `INSERT INTO assignments
              (teacher_id, title, subject, class_name, description, due_date, total_marks, created_at)
             VALUES (?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 20, NOW())`,
            [
              teacherId,
              `${subject} Assignment ${i + 1}`,
              subject, c.name,
              `Answer all questions in chapter ${i + 1}. Submit before the deadline.`,
            ]
          );

          const classStudents = studentRows.filter((s) => s.class_name === c.name);
          for (const st of classStudents) {
            if (Math.random() < 0.6) {
              const graded = Math.random() < 0.5;
              await q(
                `INSERT INTO assignment_submissions
                  (assignment_id, student_id, text, submitted_at, score, feedback, graded_at)
                 VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
                [
                  aRes.insertId, st.id,
                  `My answer for ${subject} Assignment ${i + 1}.`,
                  graded ? rand(10, 20) : null,
                  graded ? 'Good work!' : null,
                  graded ? new Date() : null,
                ]
              );
            }
          }
        }
      }
    });

    /* ================= 15. Announcements ================= */
    await step('Creating announcements', async () => {
      const rows = [
        ['Welcome Back to School', 'School resumes Monday 6th January 2025.', 'General'],
        ['Mid-Term Break', 'Mid-term break starts Friday 14th February.', 'Holiday'],
        ['Parents-Teachers Meeting', 'PTA meeting holds Saturday 22nd February at 10am.', 'Event'],
        ['Inter-House Sports', 'Annual inter-house sports competition comes up next month.', 'Event'],
        ['Exam Timetable Released', 'First term exam timetable is now available on the portal.', 'Academic'],
      ];
      for (const [title, body, category] of rows) {
        await q(
          `INSERT INTO announcements (title, body, date, audience, category)
           VALUES (?, ?, CURDATE(), 'all', ?)`,
          [title, body, category]
        );
      }
    });

    /* ================= 16. Welcome notification for admin ================= */
    await step('Creating welcome notification', async () => {
      await q(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES (?, 'announcement', 'Welcome to the portal',
                 'You have been logged in as administrator.', '/admin/home')`,
        [adminUserId]
      );
    });

    /* ================= Done ================= */
    const ms = Date.now() - startedAt;
    console.log(`\n✅ Seed complete in ${ms}ms\n`);
    console.log('   Demo logins:');
    console.log('   ─────────────────────────────────────────────');
    console.log('   Admin:   admin@school.com     / admin123');
    console.log('   Teacher: teacher@school.com   / teacher123   (class teacher, JSS 2A)');
    console.log('   Teacher: emeka@school.com     / teacher123   (subject teacher)');
    console.log('   Student: ada@school.com       / changeme123');
    console.log('   Parent:  parent@school.com    / parent123');
    console.log('');
    console.log(`   ${CLASS_DEFS.length} classes · ${teachers.length} teachers · ${studentIds.length} students`);
    console.log(`   ${studentIds.length * TERMS.length * SUBJECTS.length} result rows · ${studentIds.length * TERMS.length} fee rows`);
    console.log(`   ${studentIds.length * 20} attendance rows · quizzes + notes + assignments seeded.\n`);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch { /* ignore */ }
  }
}

seed();