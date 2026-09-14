const pool = require('./db');

async function seed() {
  console.log('Seeding database...');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Clear existing data to make the script re-runnable
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE notifications');
    await conn.query('TRUNCATE TABLE announcements');
    await conn.query('TRUNCATE TABLE class_sessions');
    await conn.query('TRUNCATE TABLE assignment_submissions');
    await conn.query('TRUNCATE TABLE assignments');
    await conn.query('TRUNCATE TABLE note_comments');
    await conn.query('TRUNCATE TABLE notes');
    await conn.query('TRUNCATE TABLE quiz_submissions');
    await conn.query('TRUNCATE TABLE quizzes');
    await conn.query('TRUNCATE TABLE fees');
    await conn.query('TRUNCATE TABLE results');
    await conn.query('TRUNCATE TABLE classes');
    await conn.query('TRUNCATE TABLE admins');
    await conn.query('TRUNCATE TABLE teachers');
    await conn.query('TRUNCATE TABLE students');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // --- USERS ---
    const users = [
      [1, 'Ada Obi', 'student@school.com', 'student123', 'student'],
      [2, 'John Bello', 'teacher@school.com', 'teacher123', 'teacher'],
      [3, 'Grace Ade', 'admin@school.com', 'admin123', 'admin'],
      [4, 'Musa Ibrahim', 'musa@school.com', 'student123', 'student'],
      [5, 'Chioma Nwosu', 'chioma@school.com', 'student123', 'student'],
    ];
    await conn.query('INSERT INTO users (id, name, email, password, role) VALUES ?', [users]);

    // --- STUDENTS ---
    const students = [
      [1, 1, 'Ada Obi', 'STD/2024/001', 'JSS 2A', 'Female', '2012-04-11', 'Mr. Peter Obi', '0803 111 2222', '12 Allen Avenue, Ikeja, Lagos', 'student@school.com', 'Blue House'],
      [2, 4, 'Musa Ibrahim', 'STD/2024/002', 'JSS 2A', 'Male', '2012-08-02', 'Alhaji Ibrahim', '0805 333 4444', '7 Ahmadu Bello Way, Kaduna', 'musa@school.com', 'Red House'],
      [3, 5, 'Chioma Nwosu', 'STD/2024/003', 'JSS 2A', 'Female', '2012-01-19', 'Mrs. Nwosu', '0807 555 6666', '3 Okigwe Road, Owerri', 'chioma@school.com', 'Green House'],
    ];
    await conn.query('INSERT INTO students (id, user_id, name, admission_no, class_name, gender, dob, guardian_name, guardian_phone, address, email, house) VALUES ?', [students]);

    // --- TEACHERS ---
    const teachers = [
      [1, 2, 'John Bello', 'TCH/001', 'teacher@school.com', '0802 000 1111', JSON.stringify(['Mathematics', 'Further Mathematics']), 'JSS 2A', 'B.Sc Mathematics, PGDE', '5 Unity Close, Ibadan', '2020-09-01'],
    ];
    await conn.query('INSERT INTO teachers (id, user_id, name, staff_no, email, phone, subjects, form_class, qualification, address, joined) VALUES ?', [teachers]);

    // --- ADMINS ---
    const admins = [
      [1, 3, 'Grace Ade', 'Principal', 'admin@school.com', '0809 777 8888', 'Principal’s Office, Admin Block', '2015-01-12'],
    ];
    await conn.query('INSERT INTO admins (id, user_id, name, title, email, phone, office, joined) VALUES ?', [admins]);

    // --- CLASSES ---
    const classes = [
      [1, 'JSS 2A', 1, JSON.stringify(['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Computer Studies']), JSON.stringify([
          { day: 'Monday', subject: 'Mathematics', time: '08:00 - 08:45', teacher: 'Mr. John Bello' },
          { day: 'Monday', subject: 'English Language', time: '08:45 - 09:30', teacher: 'Mrs. Kalu' },
          { day: 'Tuesday', subject: 'Basic Science', time: '09:30 - 10:15', teacher: 'Mr. Danjuma' },
          { day: 'Wednesday', subject: 'Social Studies', time: '10:15 - 11:00', teacher: 'Miss Yemi' },
          { day: 'Thursday', subject: 'Computer Studies', time: '11:00 - 11:45', teacher: 'Mr. Okafor' },
          { day: 'Friday', subject: 'Mathematics', time: '08:00 - 08:45', teacher: 'Mr. John Bello' },
      ])],
    ];
    await conn.query('INSERT INTO classes (id, name, teacher_id, subjects, schedule) VALUES ?', [classes]);

    // --- RESULTS ---
    const results = [
      [1, 1, '2024/2025', 'First Term', 'Mathematics', 25, 60],
      [2, 1, '2024/2025', 'First Term', 'English Language', 22, 55],
      [3, 1, '2024/2025', 'First Term', 'Basic Science', 24, 58],
      [4, 1, '2024/2025', 'First Term', 'Social Studies', 20, 48],
      [5, 1, '2024/2025', 'First Term', 'Computer Studies', 25, 62],
      [6, 2, '2024/2025', 'First Term', 'Mathematics', 18, 40],
      [7, 2, '2024/2025', 'First Term', 'English Language', 20, 45],
      [8, 2, '2024/2025', 'First Term', 'Basic Science', 22, 50],
      [9, 2, '2024/2025', 'First Term', 'Social Studies', 19, 42],
      [10, 2, '2024/2025', 'First Term', 'Computer Studies', 21, 47],
      [11, 3, '2024/2025', 'First Term', 'Mathematics', 23, 55],
      [12, 3, '2024/2025', 'First Term', 'English Language', 25, 60],
      [13, 3, '2024/2025', 'First Term', 'Basic Science', 21, 52],
      [14, 3, '2024/2025', 'First Term', 'Social Studies', 22, 51],
      [15, 3, '2024/2025', 'First Term', 'Computer Studies', 24, 58],
    ];
    await conn.query('INSERT INTO results (id, student_id, session, term, subject, ca, exam) VALUES ?', [results]);

    // --- FEES ---
    const fees = [
      [1, 1, '2024/2025', 'First Term', JSON.stringify([{ name: 'Tuition Fee', amount: 45000 }, { name: 'Books & Materials', amount: 8000 }, { name: 'Uniform', amount: 5000 }]), 30000, '2024-09-15', 'FEE-2024-0001', 'Bank Transfer'],
      [2, 1, '2023/2024', 'Third Term', JSON.stringify([{ name: 'Tuition Fee', amount: 43000 }, { name: 'Books & Materials', amount: 7000 }, { name: 'Excursion', amount: 4000 }]), 54000, '2024-05-10', 'FEE-2024-0002', 'Card'],
      [3, 2, '2024/2025', 'First Term', JSON.stringify([{ name: 'Tuition Fee', amount: 45000 }, { name: 'Books & Materials', amount: 8000 }]), 0, '2024-09-01', 'FEE-2024-0003', '-'],
      [4, 3, '2024/2025', 'First Term', JSON.stringify([{ name: 'Tuition Fee', amount: 45000 }, { name: 'Books & Materials', amount: 8000 }, { name: 'Uniform', amount: 5000 }]), 58000, '2024-09-08', 'FEE-2024-0004', 'Bank Transfer'],
    ];
    await conn.query('INSERT INTO fees (id, student_id, session, term, items, amount_paid, date, reference, method) VALUES ?', [fees]);

    // --- QUIZZES ---
    const quizzes = [
      [1, 'Algebra Basics Quiz', 'Mathematics', 'JSS 2A', 1, 15, '2025-02-20', JSON.stringify([
        { id: 1, question: 'Solve: 2x + 4 = 10', options: ['x = 2', 'x = 3', 'x = 4', 'x = 5'], answer: 1 },
        { id: 2, question: 'What is 7 × 8?', options: ['54', '56', '64', '48'], answer: 1 },
        { id: 3, question: 'Simplify: 3a + 2a', options: ['5a', '6a', 'a', '5a²'], answer: 0 },
      ])],
      [2, 'Basic Science: Living Things', 'Basic Science', 'JSS 2A', 1, 10, '2025-02-25', JSON.stringify([
        { id: 1, question: 'Which of these is a living thing?', options: ['Stone', 'Tree', 'Water', 'Sand'], answer: 1 },
        { id: 2, question: 'Plants make food through…', options: ['Respiration', 'Digestion', 'Photosynthesis', 'Excretion'], answer: 2 },
      ])],
      [3, 'English: Parts of Speech', 'English Language', 'JSS 2A', 1, 12, '2025-03-01', JSON.stringify([
        { id: 1, question: '"Quickly" is a…', options: ['Noun', 'Verb', 'Adverb', 'Adjective'], answer: 2 },
        { id: 2, question: 'A naming word is called a…', options: ['Verb', 'Noun', 'Pronoun', 'Adverb'], answer: 1 },
        { id: 3, question: 'Which is a pronoun?', options: ['She', 'Run', 'Beautiful', 'Slowly'], answer: 0 },
      ])],
    ];
    await conn.query('INSERT INTO quizzes (id, title, subject, class_name, teacher_id, duration, due_date, questions) VALUES ?', [quizzes]);

    // --- QUIZ SUBMISSIONS ---
    const quizSubs = [
      [1, 1, 2, 2, 3, '2025-02-14']
    ];
    await conn.query('INSERT INTO quiz_submissions (id, quiz_id, student_id, score, total, date) VALUES ?', [quizSubs]);

    // --- NOTES ---
    const notes = [
      [1, 1, 'Quadratic Equations — Worked Examples', 'Mathematics', 'JSS 2A', 'Step-by-step worked examples from today’s lesson.', 'pdf', 'sample-quadratics.pdf', 'Quadratic Equations.pdf', 12048, '/uploads/sample-quadratics.pdf', null, '2026-09-12 09:15:00'],
      [2, 1, 'Photosynthesis — Class Notes', 'Basic Science', 'JSS 2A', 'Written summary of today’s lesson on photosynthesis.', 'richtext', null, null, null, null, '<h2>Photosynthesis</h2><p>Photosynthesis is the process by which <strong>green plants</strong> make their own food using <em>sunlight</em>, water, and carbon dioxide.</p><ul><li><strong>Inputs:</strong> Sunlight, water, CO₂</li><li><strong>Outputs:</strong> Glucose, oxygen</li></ul><blockquote>It happens inside the <strong>chloroplasts</strong> of plant cells.</blockquote><p>Equation: <code>6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂</code></p>', '2026-09-13 10:00:00'],
    ];
    await conn.query('INSERT INTO notes (id, teacher_id, title, subject, class_name, description, type, file_name, original_name, file_size, file_url, content, uploaded_at) VALUES ?', [notes]);

    // --- NOTE COMMENTS ---
    const noteComments = [
      [1, 1, 1, 'Ada Obi', 'student', 'Thank you sir! The worked examples really helped.', '2026-09-12 11:00:00'],
    ];
    await conn.query('INSERT INTO note_comments (id, note_id, user_id, user_name, role, text, date) VALUES ?', [noteComments]);

    // --- ASSIGNMENTS ---
    const assignments = [
      [1, 1, 'Quadratic Equations Homework', 'Mathematics', 'JSS 2A', 'Solve exercises 1–10 on page 45. Show your working.', '2026-09-20', 20, '2026-09-13 08:00:00'],
    ];
    await conn.query('INSERT INTO assignments (id, teacher_id, title, subject, class_name, description, due_date, total_marks, created_at) VALUES ?', [assignments]);

    // --- ASSIGNMENT SUBMISSIONS ---
    const assignmentSubs = [
      [1, 1, 1, 'Here are my solutions. Attached working in the note.', null, null, null, '2026-09-14 10:00:00', null, null, null],
    ];
    await conn.query('INSERT INTO assignment_submissions (id, assignment_id, student_id, text, file_name, original_name, file_url, submitted_at, score, feedback, graded_at) VALUES ?', [assignmentSubs]);

    // --- CLASS SESSIONS ---
    const sessions = [
      [1, 1, 'Algebra Live Tutorial', 'Mathematics', 'JSS 2A', 'Live whiteboard session covering quadratic equations.', '2026-09-12 15:00:00', '2026-09-12 16:00:00', 'scheduled', 'math-jss2a-001', null, null],
      [2, 1, 'Basic Science — Photosynthesis', 'Basic Science', 'JSS 2A', 'Interactive session with plant-cell diagram.', '2026-09-13 10:00:00', '2026-09-13 11:00:00', 'scheduled', 'sci-jss2a-002', null, null],
    ];
    await conn.query('INSERT INTO class_sessions (id, teacher_id, title, subject, class_name, description, start_time, end_time, status, room_id, started_at, ended_at) VALUES ?', [sessions]);

    // --- ANNOUNCEMENTS ---
    const announcements = [
      [1, 'Mid-Term Break', 'School closes on Friday 21st and resumes Monday 3rd.', '2025-02-10', 'all'],
      [2, 'PTA Meeting', 'Parents are invited to the PTA meeting on Saturday 10am.', '2025-02-08', 'all'],
    ];
    await conn.query('INSERT INTO announcements (id, title, body, date, audience) VALUES ?', [announcements]);

    // --- NOTIFICATIONS ---
    const notifications = [
      [1, 1, 'assignment', 'New assignment', 'John Bello posted "Quadratic Equations Homework"', '/student/assignments', 0, '2026-09-13 08:00:00'],
    ];
    await conn.query('INSERT INTO notifications (id, user_id, type, title, body, link, `read`, created_at) VALUES ?', [notifications]);

    await conn.commit();
    console.log('✅ Database seeded successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Seeding failed:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();