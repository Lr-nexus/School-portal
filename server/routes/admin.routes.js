const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');
const { notifyAllUsers } = require('../utils/notify');

router.use(protect, allow('admin'));

/* In-memory upload for the bulk enrollment file */
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

/* ==================================================================
   COLUMN NORMALIZER — accepts many header spellings
================================================================== */
function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const COLUMN_MAP = {
  name: 'name',
  fullname: 'name',
  studentname: 'name',
  email: 'email',
  emailaddress: 'email',
  password: 'password',
  class: 'className',
  classname: 'className',
  grade: 'className',
  gender: 'gender',
  sex: 'gender',
  guardianname: 'guardianName',
  parentname: 'guardianName',
  guardianphone: 'guardianPhone',
  parentphone: 'guardianPhone',
  phone: 'guardianPhone',
  address: 'address'
};

function normalizeRow(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = COLUMN_MAP[normalizeHeader(k)];
    if (key) out[key] = String(v ?? '').trim();
  }
  return out;
}

/* ==================================================================
   PROFILE
================================================================== */
router.get('/me', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM admins WHERE user_id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Admin not found' });
  const a = rows[0];
  res.json({
    id: a.id, name: a.name, title: a.title, email: a.email,
    phone: a.phone, office: a.office, joined: a.joined
  });
});

router.patch('/me', async (req, res) => {
  const [existing] = await pool.execute(
    'SELECT id FROM admins WHERE user_id = ?',
    [req.user.id]
  );
  if (!existing.length) return res.status(404).json({ message: 'Admin not found' });

  const map = { name: 'name', email: 'email', phone: 'phone', office: 'office', title: 'title' };
  const updates = [], values = [];
  for (const [k, f] of Object.entries(map)) {
    if (req.body[k] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[k]); }
  }
  if (updates.length) {
    values.push(req.user.id);
    await pool.execute(`UPDATE admins SET ${updates.join(', ')} WHERE user_id = ?`, values);
  }

  const [rows] = await pool.execute('SELECT * FROM admins WHERE user_id = ?', [req.user.id]);
  const a = rows[0];
  res.json({
    message: 'Profile updated',
    admin: {
      id: a.id, name: a.name, title: a.title, email: a.email,
      phone: a.phone, office: a.office, joined: a.joined
    }
  });
});

/* ==================================================================
   DASHBOARD STATS
================================================================== */
router.get('/stats', async (req, res) => {
  const [[{ totalStudents }]] = await pool.execute('SELECT COUNT(*) as totalStudents FROM students');
  const [[{ totalTeachers }]] = await pool.execute('SELECT COUNT(*) as totalTeachers FROM teachers');
  const [[{ totalQuizzes }]] = await pool.execute('SELECT COUNT(*) as totalQuizzes FROM quizzes');
  const [[{ totalSubmissions }]] = await pool.execute('SELECT COUNT(*) as totalSubmissions FROM quiz_submissions');
  const [announcements] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC LIMIT 5');
  res.json({ totalStudents, totalTeachers, totalQuizzes, totalSubmissions, announcements });
});

/* ==================================================================
   STUDENTS
================================================================== */
router.get('/students', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM students ORDER BY id');
  res.json(rows.map(s => ({
    id: s.id, userId: s.user_id, name: s.name, admissionNo: s.admission_no,
    className: s.class_name, gender: s.gender, dob: s.dob,
    guardianName: s.guardian_name, guardianPhone: s.guardian_phone,
    address: s.address, email: s.email, house: s.house,
  })));
});

/* ---------- ENROLL ONE ---------- */
router.post('/students', async (req, res) => {
  const {
    name, email, password, className, gender,
    guardianName, guardianPhone, address
  } = req.body;

  if (!name || !email || !className) {
    return res.status(400).json({ message: 'Name, email and class are required' });
  }

  const [emailTaken] = await pool.execute(
    'SELECT id FROM users WHERE email = ?',
    [email.toLowerCase()]
  );
  if (emailTaken.length) {
    return res.status(400).json({ message: 'A user with that email already exists' });
  }

  const loginPassword = (password && password.trim()) || 'changeme123';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [uResult] = await conn.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email.toLowerCase(), loginPassword, 'student']
    );
    const userId = uResult.insertId;

    const [classRows] = await conn.execute(
      'SELECT id FROM classes WHERE name = ?',
      [className]
    );
    if (!classRows.length) {
      await conn.execute(
        `INSERT INTO classes (name, subjects, schedule) VALUES (?, ?, ?)`,
        [className, JSON.stringify([]), JSON.stringify([])]
      );
    }

    const [[{ maxId }]] = await conn.execute('SELECT COALESCE(MAX(id), 0) AS maxId FROM students');
    const newId = maxId + 1;
    const admissionNo = `STD/${new Date().getFullYear()}/${String(newId).padStart(3, '0')}`;

    const [sResult] = await conn.execute(
      `INSERT INTO students
        (user_id, name, admission_no, class_name, gender,
         guardian_name, guardian_phone, address, email, house)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, name, admissionNo, className,
        gender || 'Not specified',
        guardianName || '', guardianPhone || '',
        address || '', email.toLowerCase(),
        'Unassigned'
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: 'Student enrolled successfully',
      credentials: { email: email.toLowerCase(), password: loginPassword },
      student: {
        id: sResult.insertId, userId, name,
        email: email.toLowerCase(), admissionNo, className,
        gender: gender || 'Not specified'
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Enroll student failed:', err);
    res.status(500).json({ message: err.message || 'Enrollment failed' });
  } finally {
    conn.release();
  }
});

/* ---------- BULK ENROLL (CSV / XLSX) ---------- */
router.post('/students/bulk', uploadMemory.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let rawRows;
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (err) {
    return res.status(400).json({
      message: 'Could not read the file. Make sure it is a valid CSV or XLSX.'
    });
  }

  if (!rawRows.length) {
    return res.status(400).json({ message: 'The file has no data rows' });
  }

  const defaultPassword =
    String(req.body.defaultPassword || '').trim() || 'changeme123';

  /* Preload existing emails once so we don't query per row */
  const [existing] = await pool.execute(
    'SELECT LOWER(email) AS email FROM users'
  );
  const emailSet = new Set(existing.map((r) => r.email));

  const seenInFile = new Set();
  const results = []; // { row, name, email, status, message, admissionNo? }
  let successCount = 0;

  const conn = await pool.getConnection();
  try {
    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // +2 because header is row 1
      const data = normalizeRow(rawRows[i]);

      /* Skip fully blank rows silently */
      const isEmpty = Object.values(data).every((v) => !v);
      if (isEmpty) continue;

      const push = (status, message, extra = {}) =>
        results.push({
          row: rowNumber,
          name: data.name || '(no name)',
          email: data.email || '(no email)',
          status,
          message,
          ...extra
        });

      /* Validate */
      if (!data.name) {
        push('failed', 'Missing name');
        continue;
      }
      if (!data.email) {
        push('failed', 'Missing email');
        continue;
      }
      if (!/^\S+@\S+\.\S+$/.test(data.email)) {
        push('failed', 'Invalid email format');
        continue;
      }
      if (!data.className) {
        push('failed', 'Missing class');
        continue;
      }

      const email = data.email.toLowerCase();

      if (emailSet.has(email)) {
        push('failed', 'Email already exists');
        continue;
      }
      if (seenInFile.has(email)) {
        push('failed', 'Duplicate email in file');
        continue;
      }

      /* Try to insert — SAVEPOINT so a single failure doesn't kill the batch */
      await conn.execute('SAVEPOINT sp_row');
      try {
        const loginPassword = data.password || defaultPassword;

        /* 1. user */
        const [uResult] = await conn.execute(
          'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
          [data.name, email, loginPassword, 'student']
        );
        const userId = uResult.insertId;

        /* 2. class (find-or-create) */
        const [classRows] = await conn.execute(
          'SELECT id FROM classes WHERE name = ?',
          [data.className]
        );
        if (!classRows.length) {
          await conn.execute(
            `INSERT INTO classes (name, subjects, schedule) VALUES (?, ?, ?)`,
            [data.className, JSON.stringify([]), JSON.stringify([])]
          );
        }

        /* 3. admission number */
        const [[{ maxId }]] = await conn.execute(
          'SELECT COALESCE(MAX(id), 0) AS maxId FROM students'
        );
        const admissionNo =
          `STD/${new Date().getFullYear()}/${String(maxId + 1).padStart(3, '0')}`;

        /* 4. student */
        await conn.execute(
          `INSERT INTO students
            (user_id, name, admission_no, class_name, gender,
             guardian_name, guardian_phone, address, email, house)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, data.name, admissionNo, data.className,
            data.gender || 'Not specified',
            data.guardianName || '', data.guardianPhone || '',
            data.address || '', email, 'Unassigned'
          ]
        );

        await conn.execute('RELEASE SAVEPOINT sp_row');

        seenInFile.add(email);
        emailSet.add(email);
        successCount++;
        push('success', 'Enrolled', {
          admissionNo,
          generatedPassword: loginPassword
        });
      } catch (rowErr) {
        await conn.execute('ROLLBACK TO SAVEPOINT sp_row');
        console.error(`Bulk row ${rowNumber} failed:`, rowErr.message);
        push('failed', rowErr.message || 'Insert failed');
      }
    }

    await conn.commit();

    res.json({
      message: `Processed ${results.length} row(s) — ${successCount} enrolled`,
      total: results.length,
      succeeded: successCount,
      failed: results.length - successCount,
      results
    });
  } catch (err) {
    await conn.rollback();
    console.error('Bulk enrollment failed:', err);
    res.status(500).json({ message: err.message || 'Bulk enrollment failed' });
  } finally {
    conn.release();
  }
});

/* ---------- DELETE STUDENT ---------- */
router.delete('/students/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT id, user_id, name, admission_no FROM students WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Student not found' });
    }
    const student = rows[0];

    await conn.execute('DELETE FROM students WHERE id = ?', [student.id]);
    if (student.user_id) {
      await conn.execute('DELETE FROM users WHERE id = ?', [student.user_id]);
    }

    await conn.commit();
    res.json({
      message: 'Student removed',
      removed: {
        id: student.id, name: student.name, admissionNo: student.admission_no
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Delete student failed:', err);
    res.status(500).json({ message: err.message || 'Failed to remove student' });
  } finally {
    conn.release();
  }
});

/* ---------- SINGLE STUDENT'S RESULTS ---------- */
router.get('/students/:id/results', async (req, res) => {
  const [sRows] = await pool.execute('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!sRows.length) return res.status(404).json({ message: 'Student not found' });
  const student = sRows[0];

  const [results] = await pool.execute(
    'SELECT * FROM results WHERE student_id = ?',
    [student.id]
  );
  const formatted = results.map((r) => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    return { ...r, total, grade, remark };
  });
  const average = formatted.length
    ? Math.round(formatted.reduce((s, r) => s + r.total, 0) / formatted.length)
    : 0;

  res.json({
    student: {
      id: student.id, name: student.name,
      className: student.class_name, admissionNo: student.admission_no
    },
    session: results[0]?.session || '2024/2025',
    term: results[0]?.term || 'First Term',
    subjects: formatted, average,
    overallGrade: gradeFor(average).grade
  });
});

/* ==================================================================
   TEACHERS
================================================================== */
router.get('/teachers', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM teachers ORDER BY id');
  res.json(rows.map(t => ({
    id: t.id, userId: t.user_id, name: t.name, staffNo: t.staff_no,
    email: t.email, phone: t.phone,
    subjects: JSON.parse(t.subjects || '[]'),
    formClass: t.form_class, qualification: t.qualification,
    address: t.address, joined: t.joined,
  })));
});

router.post('/teachers', async (req, res) => {
  const {
    name, email, password, phone, subjects,
    formClass, qualification, address
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  const [emailTaken] = await pool.execute(
    'SELECT id FROM users WHERE email = ?',
    [email.toLowerCase()]
  );
  if (emailTaken.length) {
    return res.status(400).json({ message: 'A user with that email already exists' });
  }

  const subjectList = Array.isArray(subjects)
    ? subjects
    : String(subjects || '').split(',').map(s => s.trim()).filter(Boolean);

  const loginPassword = (password && password.trim()) || 'changeme123';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [uResult] = await conn.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email.toLowerCase(), loginPassword, 'teacher']
    );
    const userId = uResult.insertId;

    const [[{ maxId }]] = await conn.execute('SELECT COALESCE(MAX(id), 0) AS maxId FROM teachers');
    const newId = maxId + 1;
    const staffNo = `TCH/${String(newId).padStart(3, '0')}`;

    const [tResult] = await conn.execute(
      `INSERT INTO teachers
        (user_id, name, staff_no, email, phone, subjects,
         form_class, qualification, address, joined)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [
        userId, name, staffNo, email.toLowerCase(),
        phone || '', JSON.stringify(subjectList),
        formClass || 'Unassigned', qualification || '', address || ''
      ]
    );

    if (formClass && formClass.trim()) {
      const [classRows] = await conn.execute(
        'SELECT id FROM classes WHERE name = ?',
        [formClass.trim()]
      );
      if (classRows.length) {
        await conn.execute(
          'UPDATE classes SET teacher_id = ? WHERE id = ?',
          [tResult.insertId, classRows[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO classes (name, teacher_id, subjects, schedule)
           VALUES (?, ?, ?, ?)`,
          [formClass.trim(), tResult.insertId, JSON.stringify([]), JSON.stringify([])]
        );
      }
    }

    await conn.commit();
    res.status(201).json({
      message: 'Teacher enrolled successfully',
      credentials: { email: email.toLowerCase(), password: loginPassword },
      teacher: {
        id: tResult.insertId, userId, name,
        email: email.toLowerCase(), staffNo,
        subjects: subjectList, formClass: formClass || 'Unassigned'
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Enroll teacher failed:', err);
    res.status(500).json({ message: err.message || 'Enrollment failed' });
  } finally {
    conn.release();
  }
});

router.delete('/teachers/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT id, user_id, name, staff_no FROM teachers WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Teacher not found' });
    }
    const teacher = rows[0];

    await conn.execute(
      'UPDATE classes SET teacher_id = NULL WHERE teacher_id = ?',
      [teacher.id]
    );
    await conn.execute('DELETE FROM teachers WHERE id = ?', [teacher.id]);
    if (teacher.user_id) {
      await conn.execute('DELETE FROM users WHERE id = ?', [teacher.user_id]);
    }

    await conn.commit();
    res.json({
      message: 'Teacher removed',
      removed: {
        id: teacher.id, name: teacher.name, staffNo: teacher.staff_no
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Delete teacher failed:', err);
    res.status(500).json({ message: err.message || 'Failed to remove teacher' });
  } finally {
    conn.release();
  }
});

/* ==================================================================
   RESULTS (all students)
================================================================== */
router.get('/results', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.*, s.name AS studentName, s.class_name AS className
     FROM results r JOIN students s ON s.id = r.student_id
     ORDER BY r.id DESC`
  );
  res.json(rows.map(r => {
    const total = totalOf(r);
    const { grade, remark } = gradeFor(total);
    return { ...r, total, grade, remark };
  }));
});

/* ==================================================================
   LMS PERFORMANCE
================================================================== */
router.get('/lms/performance', async (req, res) => {
  const [students] = await pool.execute('SELECT id, name, class_name FROM students');
  const [quizzes] = await pool.execute(
    'SELECT id, title, subject, class_name, questions, due_date FROM quizzes'
  );
  const [submissions] = await pool.execute('SELECT * FROM quiz_submissions');

  const studentRows = students.map((s) => {
    const mySubs = submissions.filter(sub => sub.student_id === s.id);
    const totalScore = mySubs.reduce((sum, sub) => sum + sub.score, 0);
    const totalQuestions = mySubs.reduce((sum, sub) => sum + sub.total, 0);
    const average = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0;
    return {
      id: s.id, name: s.name, className: s.class_name,
      quizzesTaken: mySubs.length,
      totalQuizzes: quizzes.filter(q => q.class_name === s.class_name).length,
      score: totalScore, totalQuestions, average,
    };
  });

  const quizRows = quizzes.map(q => ({
    id: q.id, title: q.title, subject: q.subject, className: q.class_name,
    questionCount: JSON.parse(q.questions || '[]').length,
    dueDate: q.due_date,
    submissionCount: submissions.filter(s => s.quiz_id === q.id).length,
  }));

  res.json({ students: studentRows, quizzes: quizRows });
});

/* ==================================================================
   ANNOUNCEMENTS
================================================================== */
router.get('/announcements', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY date DESC');
  res.json(rows);
});

router.post('/announcements', async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ message: 'Title and body are required' });

  const [result] = await pool.execute(
    'INSERT INTO announcements (title, body, date, audience) VALUES (?, ?, CURDATE(), ?)',
    [title, body, 'all']
  );

  await notifyAllUsers({
    type: 'announcement',
    title: 'New announcement',
    body: `${title} — ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}`,
    link: '/home'
  });

  const [rows] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Announcement posted', announcement: rows[0] });
});

module.exports = router;