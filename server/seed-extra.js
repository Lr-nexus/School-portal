require('dotenv').config();
const pool = require('./db');

const q = (sql, params = []) => pool.query(sql, params);

async function step(label, fn) {
  process.stdout.write(`   → ${label} `);
  try {
    const r = await fn();
    console.log('✓');
    return r;
  } catch (e) {
    console.log('✗');
    console.error(`      ${e.message}`);
    throw e;
  }
}

/* Extra announcements to test announcement/category features */
const EXTRA_ANNOUNCEMENTS = [
  ['Sports Day Postponed', 'The inter-house sports competition has been postponed to 15th March due to weather.', 'Event'],
  ['New Library Books', 'We received 200 new books this week. Visit the library to borrow.', 'General'],
  ['Mid-Term Results Out', 'First-term results are now visible on each student dashboard.', 'Academic'],
  ['Holiday Notice', 'School will be closed from 20th – 27th December for Christmas break.', 'Holiday'],
];

/* Extra assignments for the teacher to grade */
const EXTRA_ASSIGNMENTS = [
  { title: 'Algebra Worksheet 3',  subject: 'Mathematics',     desc: 'Solve problems 1–20 in exercise 5.2',  marks: 20 },
  { title: 'Essay: My Hero',       subject: 'English Language',desc: 'Write a 300-word essay about someone you admire.', marks: 15 },
  { title: 'Cell Diagram',         subject: 'Basic Science',   desc: 'Draw and label a plant cell.',         marks: 10 },
  { title: 'Weather Chart',        subject: 'Social Studies',  desc: 'Record the weather for 7 days.',       marks: 10 },
];

async function run() {
  console.log('\n🌱 Adding extra sample data…\n');

  /* ---------- 1. Extra announcements ---------- */
  await step('Adding 4 extra announcements', async () => {
    for (const [title, body, category] of EXTRA_ANNOUNCEMENTS) {
      const [existing] = await q(
        'SELECT id FROM announcements WHERE title = ?',
        [title]
      );
      if (existing.length) continue;
      await q(
        `INSERT INTO announcements (title, body, date, audience, category)
         VALUES (?, ?, CURDATE(), 'all', ?)`,
        [title, body, category]
      );
    }
  });

  /* ---------- 2. Extra assignments + submissions for JSS 2A ---------- */
  await step('Adding 4 extra assignments to JSS 2A', async () => {
    // Find the class teacher for JSS 2A
    const [teachers] = await q(`
      SELECT t.id, t.user_id
      FROM teachers t
      JOIN classes c ON c.teacher_id = t.id
      WHERE c.name = 'JSS 2A'
      LIMIT 1
    `);
    if (!teachers.length) throw new Error('No teacher for JSS 2A — run seed.js first');
    const teacherId = teachers[0].id;

    // Get all students in JSS 2A
    const [students] = await q(
      "SELECT id, name FROM students WHERE class_name = 'JSS 2A'"
    );
    if (!students.length) throw new Error('No students in JSS 2A — run seed.js first');

    for (const a of EXTRA_ASSIGNMENTS) {
      const [existing] = await q(
        'SELECT id FROM assignments WHERE title = ? AND class_name = ?',
        [a.title, 'JSS 2A']
      );
      let assignId;
      if (existing.length) {
        assignId = existing[0].id;
      } else {
        const [res] = await q(
          `INSERT INTO assignments
             (teacher_id, title, subject, class_name, description, due_date, total_marks, created_at)
           VALUES (?, ?, ?, 'JSS 2A', ?, DATE_ADD(CURDATE(), INTERVAL 10 DAY), ?, NOW())`,
          [teacherId, a.title, a.subject, a.desc, a.marks]
        );
        assignId = res.insertId;
      }

      // Give every student a submission with a random score
      for (const st of students) {
        const [sub] = await q(
          'SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
          [assignId, st.id]
        );
        if (sub.length) continue;
        const score = Math.floor(Math.random() * a.marks * 0.6) + Math.floor(a.marks * 0.4);
        await q(
          `INSERT INTO assignment_submissions
             (assignment_id, student_id, text, submitted_at, score, feedback, graded_at)
           VALUES (?, ?, ?, NOW(), ?, ?, NOW())`,
          [assignId, st.id, `My work for "${a.title}".`, score,
            score >= a.marks * 0.75 ? 'Great work!' : 'Keep practising.']
        );
      }
    }
  });

  /* ---------- 3. Extra quizzes with submissions ---------- */
  await step('Adding 3 extra quizzes', async () => {
    const [teachers] = await q(
      `SELECT t.id FROM teachers t
       JOIN classes c ON c.teacher_id = t.id
       WHERE c.name = 'JSS 2A' LIMIT 1`
    );
    if (!teachers.length) throw new Error('No teacher for JSS 2A');
    const teacherId = teachers[0].id;

    const [students] = await q(
      "SELECT id FROM students WHERE class_name = 'JSS 2A'"
    );

    const QUIZZES = [
      { title: 'Fractions Mastery', subject: 'Mathematics',       questions: 5 },
      { title: 'Vocab Builder',     subject: 'English Language',  questions: 5 },
      { title: 'Plant Life Quiz',   subject: 'Basic Science',     questions: 5 },
    ];

    for (const qz of QUIZZES) {
      const [existing] = await q(
        'SELECT id FROM quizzes WHERE title = ? AND class_name = ?',
        [qz.title, 'JSS 2A']
      );
      let quizId;
      if (existing.length) {
        quizId = existing[0].id;
      } else {
        const questions = Array.from({ length: qz.questions }, (_, i) => ({
          id: i + 1,
          question: `Q${i + 1} sample question for ${qz.subject}`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          answer: Math.floor(Math.random() * 4),
        }));
        const [res] = await q(
          `INSERT INTO quizzes
             (title, subject, class_name, teacher_id, duration, due_date, questions)
           VALUES (?, ?, 'JSS 2A', ?, 15, DATE_ADD(CURDATE(), INTERVAL 5 DAY), ?)`,
          [qz.title, qz.subject, teacherId, JSON.stringify(questions)]
        );
        quizId = res.insertId;
      }

      // Give most students a submission
      for (const st of students) {
        const [sub] = await q(
          'SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?',
          [quizId, st.id]
        );
        if (sub.length) continue;
        if (Math.random() < 0.75) {
          await q(
            `INSERT INTO quiz_submissions (quiz_id, student_id, score, total, date)
             VALUES (?, ?, ?, ?, CURDATE())`,
            [quizId, st.id, Math.floor(Math.random() * 5) + 1, 5]
          );
        }
      }
    }
  });

  /* ---------- 4. Extra notes ---------- */
  await step('Adding 3 extra notes for JSS 2A', async () => {
    const [teachers] = await q(
      `SELECT t.id FROM teachers t
       JOIN classes c ON c.teacher_id = t.id
       WHERE c.name = 'JSS 2A' LIMIT 1`
    );
    if (!teachers.length) throw new Error('No teacher for JSS 2A');
    const teacherId = teachers[0].id;

    const NOTES = [
      { title: 'Algebra Refresher', subject: 'Mathematics',
        body: '<h2>Algebra Refresher</h2><p>Remember: <strong>a + b = b + a</strong>.</p><ul><li>Commutative</li><li>Associative</li><li>Distributive</li></ul>' },
      { title: 'Essay Writing Tips', subject: 'English Language',
        body: '<h2>Essay Writing</h2><ol><li>Plan your points</li><li>Use paragraphs</li><li>Proofread twice</li></ol>' },
      { title: 'Photosynthesis at a glance', subject: 'Basic Science',
        body: '<h2>Photosynthesis</h2><p>Plants make food using sunlight, water, and CO₂.</p><blockquote>Light + H₂O + CO₂ → Sugar + O₂</blockquote>' },
    ];

    for (const n of NOTES) {
      const [existing] = await q(
        'SELECT id FROM notes WHERE title = ? AND class_name = ?',
        [n.title, 'JSS 2A']
      );
      if (existing.length) continue;
      await q(
        `INSERT INTO notes
           (teacher_id, title, subject, class_name, description, type, content, uploaded_at)
         VALUES (?, ?, ?, 'JSS 2A', ?, 'richtext', ?, NOW())`,
        [teacherId, n.title, n.subject, 'Extra study material.', n.body]
      );
    }
  });

  /* ---------- 5. Extra calendar events ---------- */
  await step('Adding 5 calendar events', async () => {
    const [admin] = await q("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (!admin.length) throw new Error('No admin found');
    const adminId = admin[0].id;

    const EVENTS = [
      { title: 'PTA Meeting',           category: 'Meeting', offset: 7  },
      { title: 'Mid-Term Exams Begin',  category: 'Exam',    offset: 21 },
      { title: 'Inter-House Sports',    category: 'Sports',  offset: 30 },
      { title: 'Cultural Day',          category: 'Event',   offset: 45 },
      { title: 'End of Term',           category: 'Holiday', offset: 60 },
    ];

    for (const e of EVENTS) {
      const [existing] = await q(
        'SELECT id FROM calendar_events WHERE title = ?',
        [e.title]
      );
      if (existing.length) continue;
      await q(
        `INSERT INTO calendar_events
           (title, description, date, category, audience, created_by)
         VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, 'all', ?)`,
        [e.title, `${e.title} at Bright Future.`, e.offset, e.category, adminId]
      );
    }
  });

  /* ---------- 6. Extra grades for the gradebook view ---------- */
  await step('Adding grades for 2 terms and 5 subjects', async () => {
    const [students] = await q(
      "SELECT id FROM students WHERE class_name = 'JSS 2A'"
    );
    if (!students.length) throw new Error('No students in JSS 2A');

    const SUBJECTS = ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Computer Studies'];
    const SESSIONS = ['2024/2025', '2025/2026'];

    for (const st of students) {
      for (const session of SESSIONS) {
        for (const term of ['First Term', 'Second Term']) {
          for (const subject of SUBJECTS) {
            const [existing] = await q(
              `SELECT id FROM results
               WHERE student_id = ? AND session = ? AND term = ? AND subject = ?`,
              [st.id, session, term, subject]
            );
            if (existing.length) continue;
            await q(
              `INSERT INTO results (student_id, session, term, subject, ca, exam)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [st.id, session, term, subject,
                Math.floor(Math.random() * 15) + 15,
                Math.floor(Math.random() * 30) + 40]
            );
          }
        }
      }
    }
  });

  console.log('\n✅ Extra seed complete!\n');
  console.log('   What to test now:');
  console.log('     • Login with each role — try the Remember Me checkbox');
  console.log('     • Toggle dark/light on the login page — the choice persists');
  console.log('     • Click any profile → upload a photo');
  console.log('     • Toast notifications appear top-right');
  console.log('     • Install the app: browser menu → "Install BF Portal"');
  console.log('     • Announcements, notes, quizzes, and assignments now have more content\n');
}

run()
  .catch((err) => {
    console.error('\n❌ Extra seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));