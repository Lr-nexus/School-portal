const router = require('express').Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../db');
const { protect, allow } = require('../middleware/auth');
const { gradeFor, totalOf } = require('../utils/grades');
const { notifyAllUsers } = require('../utils/notify');

router.use(protect, allow('admin'));

/* ==================================================================
   BULK IMPORT — multer setup
================================================================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      return cb(null, true);
    }
    cb(new Error('Only .xlsx, .xls or .csv files are allowed'));
  }
});

function normalizeRow(raw) {
  const out = {};
  Object.keys(raw).forEach((key) => {
    const normalized = String(key).toLowerCase().replace(/[\s_-]/g, '');
    out[normalized] = String(raw[key] ?? '').trim();
  });
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

  // ⭐ Sync the shared users table
  const userUpdates = [], userValues = [];
  if (req.body.name !== undefined)  { userUpdates.push('name = ?');  userValues.push(req.body.name); }
  if (req.body.email !== undefined) { userUpdates.push('email = ?'); userValues.push(String(req.body.email).toLowerCase()); }
  if (userUpdates.length) {
    userValues.push(req.user.id);
    await pool.execute(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
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
   CLASSES
================================================================== */
router.get('/classes', async (req, res) => {
  try {
    const [classes] = await pool.execute(`
      SELECT
        c.id,
        c.name,
        c.teacher_id,
        t.name  AS teacher_name,
        t.email AS teacher_email,
        t.phone AS teacher_phone,
        t.subjects AS teacher_subjects,
        t.staff_no AS teacher_staff_no
      FROM classes c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      ORDER BY c.name
    `);

    const result = await Promise.all(
      classes.map(async (c) => {
        const [students] = await pool.execute(
          `SELECT id, name, admission_no, gender, email
           FROM students WHERE class_name = ? ORDER BY name`,
          [c.name]
        );

        let teacherSubjects = [];
        try { teacherSubjects = JSON.parse(c.teacher_subjects || '[]'); }
        catch { teacherSubjects = []; }

        return {
          id: c.id,
          name: c.name,
          teacher: c.teacher_name
            ? {
                id: c.teacher_id,
                name: c.teacher_name,
                email: c.teacher_email,
                phone: c.teacher_phone,
                staffNo: c.teacher_staff_no,
                subjects: teacherSubjects,
              }
            : null,
          students: students.map((s) => ({
            id: s.id,
            name: s.name,
            admissionNo: s.admission_no,
            gender: s.gender,
            email: s.email,
          })),
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('List classes failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load classes' });
  }
});

/* ==================================================================
   FEES — ADMIN MANAGEMENT
================================================================== */

/* ---------- LIST all published fee batches ---------- */
router.get('/fees', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        f.reference,
        MIN(f.id)              AS id,
        MIN(f.session)         AS session,
        MIN(f.term)            AS term,
        MIN(f.items)           AS items,
        MIN(f.date)            AS date,
        COUNT(*)               AS student_count,
        SUM(f.amount_paid)     AS total_collected
      FROM fees f
      WHERE f.reference IS NOT NULL
      GROUP BY f.reference
      ORDER BY MIN(f.id) DESC
    `);

    res.json(rows.map((r) => {
      const items = JSON.parse(r.items || '[]');
      const totalPerStudent = items.reduce((sum, i) => sum + Number(i.amount), 0);
      return {
        id: r.id,
        reference: r.reference,
        session: r.session,
        term: r.term,
        items,
        date: r.date,
        studentCount: r.student_count,
        totalPerStudent,
        totalBilled: totalPerStudent * r.student_count,
        totalCollected: Number(r.total_collected || 0),
      };
    }));
  } catch (err) {
    console.error('List fees failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load fees' });
  }
});

/* ---------- PREVIEW students who will receive the fee ---------- */
router.get('/fees/preview/:className', async (req, res) => {
  const className = decodeURIComponent(req.params.className);

  let students;
  if (className === 'ALL') {
    [students] = await pool.execute(
      'SELECT id, name, admission_no, class_name FROM students ORDER BY class_name, name'
    );
  } else {
    [students] = await pool.execute(
      'SELECT id, name, admission_no, class_name FROM students WHERE class_name = ? ORDER BY name',
      [className]
    );
  }

  res.json(students.map((s) => ({
    id: s.id,
    name: s.name,
    admissionNo: s.admission_no,
    className: s.class_name,
  })));
});

/* ---------- ONE batch with per-student breakdown ---------- */
router.get('/fees/:reference', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT f.*, s.name AS student_name, s.admission_no, s.class_name
     FROM fees f
     JOIN students s ON s.id = f.student_id
     WHERE f.reference = ?
     ORDER BY s.class_name, s.name`,
    [req.params.reference]
  );
  if (!rows.length) return res.status(404).json({ message: 'Fee batch not found' });

  const items = JSON.parse(rows[0].items || '[]');
  const totalPerStudent = items.reduce((sum, i) => sum + Number(i.amount), 0);

  res.json({
    reference: req.params.reference,
    session: rows[0].session,
    term: rows[0].term,
    items,
    date: rows[0].date,
    totalPerStudent,
    students: rows.map((r) => {
      const paid = parseFloat(r.amount_paid);
      const balance = Math.max(totalPerStudent - paid, 0);
      return {
        feeId: r.id,
        studentId: r.student_id,
        name: r.student_name,
        admissionNo: r.admission_no,
        className: r.class_name,
        amountPaid: paid,
        balance,
        status: balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
        method: r.method,
      };
    }),
  });
});

/* ---------- PUBLISH a fee to a class (or all students) ---------- */
router.post('/fees', async (req, res) => {
  const { session, term, className, dueDate, items } = req.body;

  if (!session || !term || !className || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: 'session, term, className and at least one item are required',
    });
  }

  for (const item of items) {
    if (!item.name || !item.amount || Number(item.amount) <= 0) {
      return res.status(400).json({
        message: 'Each fee item needs a name and a positive amount',
      });
    }
  }

  let students;
  if (className === 'ALL') {
    [students] = await pool.execute('SELECT id, name FROM students');
  } else {
    [students] = await pool.execute(
      'SELECT id, name FROM students WHERE class_name = ?',
      [className]
    );
  }

  if (!students.length) {
    return res.status(400).json({
      message: className === 'ALL'
        ? 'No students enrolled yet'
        : `No students in ${className}`,
    });
  }

  const [[{ count }]] = await pool.execute(
    "SELECT COUNT(DISTINCT reference) AS count FROM fees WHERE reference LIKE 'PUB-%'"
  );
  const seq = String(Number(count) + 1).padStart(4, '0');
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reference = `PUB-${datePart}-${seq}`;

  const itemsJson = JSON.stringify(
    items.map((i) => ({ name: String(i.name).trim(), amount: Number(i.amount) }))
  );
  const feeDate = dueDate || new Date().toISOString().split('T')[0];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const student of students) {
      await conn.execute(
        `INSERT INTO fees
          (student_id, session, term, items, amount_paid, date, reference, method)
         VALUES (?, ?, ?, ?, 0, ?, ?, '-')`,
        [student.id, session, term, itemsJson, feeDate, reference]
      );
    }

    await conn.commit();

    const totalPerStudent = items.reduce((sum, i) => sum + Number(i.amount), 0);

    res.status(201).json({
      message: `Fee published to ${students.length} student${students.length === 1 ? '' : 's'}`,
      reference,
      studentCount: students.length,
      totalPerStudent,
      totalBilled: totalPerStudent * students.length,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Publish fee failed:', err);
    res.status(500).json({ message: err.message || 'Failed to publish fee' });
  } finally {
    conn.release();
  }
});

/* ---------- DELETE a published fee batch ---------- */
router.delete('/fees/:reference', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[{ paidCount }]] = await conn.execute(
      'SELECT COUNT(*) AS paidCount FROM fees WHERE reference = ? AND amount_paid > 0',
      [req.params.reference]
    );

    if (Number(paidCount) > 0) {
      await conn.rollback();
      return res.status(400).json({
        message: `Cannot delete — ${paidCount} student(s) have already made payments on this fee.`,
      });
    }

    const [result] = await conn.execute(
      'DELETE FROM fees WHERE reference = ?',
      [req.params.reference]
    );

    await conn.commit();

    res.json({
      message: `Deleted ${result.affectedRows} fee record(s)`,
      affectedRows: result.affectedRows,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Delete fee failed:', err);
    res.status(500).json({ message: err.message || 'Failed to delete fee' });
  } finally {
    conn.release();
  }
});

/* ==================================================================
   STUDENTS — LIST
================================================================== */
router.get('/students', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM students ORDER BY id');
  res.json(rows.map((s) => ({
    id: s.id, userId: s.user_id, name: s.name, admissionNo: s.admission_no,
    className: s.class_name, gender: s.gender, dob: s.dob,
    guardianName: s.guardian_name, guardianPhone: s.guardian_phone,
    address: s.address, email: s.email, house: s.house,
  })));
});

/* ==================================================================
   STUDENTS — CREATE (single)
================================================================== */
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

    const [[{ maxId }]] = await conn.execute('SELECT MAX(id) AS maxId FROM students');
    const newId = (maxId || 0) + 1;
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
      credentials: {
        email: email.toLowerCase(),
        password: loginPassword
      },
      student: {
        id: sResult.insertId,
        userId,
        name,
        email: email.toLowerCase(),
        admissionNo,
        className,
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

/* ==================================================================
   STUDENTS — DELETE (single)
================================================================== */
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
        id: student.id,
        name: student.name,
        admissionNo: student.admission_no
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

/* ==================================================================
   STUDENTS — BULK DELETE
================================================================== */
router.post('/students/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ message: 'No student IDs provided' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const placeholders = ids.map(() => '?').join(',');

    const [rows] = await conn.execute(
      `SELECT id, user_id, name FROM students WHERE id IN (${placeholders})`,
      ids
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'No matching students found' });
    }

    await conn.execute(
      `DELETE FROM students WHERE id IN (${placeholders})`,
      ids
    );

    const userIds = rows.map((r) => r.user_id).filter(Boolean);
    if (userIds.length) {
      const uPlaceholders = userIds.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM users WHERE id IN (${uPlaceholders})`,
        userIds
      );
    }

    await conn.commit();
    res.json({
      message: `${rows.length} student(s) removed`,
      removed: rows.map((r) => r.name)
    });
  } catch (err) {
    await conn.rollback();
    console.error('Bulk delete students failed:', err);
    res.status(500).json({ message: err.message || 'Bulk delete failed' });
  } finally {
    conn.release();
  }
});

/* ==================================================================
   STUDENTS — BULK IMPORT
================================================================== */
router.post('/students/bulk-import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let rows;
  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  } catch (err) {
    return res.status(400).json({ message: 'Could not read file: ' + err.message });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'Spreadsheet is empty' });
  }

  const created = [];
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = normalizeRow(rows[i]);
    const line = i + 2;

    const name = row.name;
    const email = (row.email || '').toLowerCase();
    const className = row.classname || row.class;
    const password = row.password || 'changeme123';

    if (!name || !email || !className) {
      failed.push({ line, name, email, reason: 'name, email and classname are required' });
      continue;
    }

    try {
      const [taken] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      if (taken.length) {
        failed.push({ line, name, email, reason: 'Email already exists' });
        continue;
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [uResult] = await conn.execute(
          'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
          [name, email, password, 'student']
        );
        const userId = uResult.insertId;

        const [cls] = await conn.execute(
          'SELECT id FROM classes WHERE name = ?',
          [className]
        );
        if (!cls.length) {
          await conn.execute(
            'INSERT INTO classes (name, subjects, schedule) VALUES (?, ?, ?)',
            [className, JSON.stringify([]), JSON.stringify([])]
          );
        }

        const [[{ maxId }]] = await conn.execute('SELECT MAX(id) AS maxId FROM students');
        const newId = (maxId || 0) + 1;
        const admissionNo = `STD/${new Date().getFullYear()}/${String(newId).padStart(3, '0')}`;

        await conn.execute(
          `INSERT INTO students
            (user_id, name, admission_no, class_name, gender,
             guardian_name, guardian_phone, address, email, house)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, name, admissionNo, className,
            row.gender || 'Not specified',
            row.guardianname || '', row.guardianphone || '',
            row.address || '', email, 'Unassigned'
          ]
        );

        await conn.commit();
        created.push({ name, email, className, admissionNo });
      } catch (innerErr) {
        await conn.rollback();
        throw innerErr;
      } finally {
        conn.release();
      }
    } catch (err) {
      failed.push({ line, name, email, reason: err.message });
    }
  }

  res.json({
    message: `${created.length} student(s) imported, ${failed.length} failed`,
    totalRows: rows.length,
    created,
    failed
  });
});

/* ==================================================================
   STUDENTS — SINGLE STUDENT'S RESULTS
================================================================== */
router.get('/students/:id/results', async (req, res) => {
  const [sRows] = await pool.execute('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!sRows.length) return res.status(404).json({ message: 'Student not found' });
  const student = sRows[0];

  const [results] = await pool.execute('SELECT * FROM results WHERE student_id = ?', [student.id]);
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
   TEACHERS — LIST
================================================================== */
router.get('/teachers', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM teachers ORDER BY id');
  res.json(rows.map((t) => ({
    id: t.id, userId: t.user_id, name: t.name, staffNo: t.staff_no,
    email: t.email, phone: t.phone,
    subjects: JSON.parse(t.subjects || '[]'),
    formClass: t.form_class, qualification: t.qualification,
    address: t.address, joined: t.joined,
  })));
});

/* ==================================================================
   TEACHERS — CREATE (single)
================================================================== */
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
    : String(subjects || '').split(',').map((s) => s.trim()).filter(Boolean);

  const loginPassword = (password && password.trim()) || 'changeme123';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [uResult] = await conn.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email.toLowerCase(), loginPassword, 'teacher']
    );
    const userId = uResult.insertId;

    const [[{ maxId }]] = await conn.execute('SELECT MAX(id) AS maxId FROM teachers');
    const newId = (maxId || 0) + 1;
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
        'SELECT id, subjects FROM classes WHERE name = ?',
        [formClass.trim()]
      );
      if (classRows.length) {
        await conn.execute(
          `UPDATE classes
           SET teacher_id = ?,
               subjects = CASE
                 WHEN subjects IS NULL OR subjects = '' OR subjects = '[]'
                 THEN ?
                 ELSE subjects
               END
           WHERE id = ?`,
          [tResult.insertId, JSON.stringify(subjectList), classRows[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO classes (name, teacher_id, subjects, schedule)
           VALUES (?, ?, ?, ?)`,
          [formClass.trim(), tResult.insertId, JSON.stringify(subjectList), JSON.stringify([])]
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      message: 'Teacher enrolled successfully',
      credentials: {
        email: email.toLowerCase(),
        password: loginPassword
      },
      teacher: {
        id: tResult.insertId,
        userId,
        name,
        email: email.toLowerCase(),
        staffNo,
        subjects: subjectList,
        formClass: formClass || 'Unassigned'
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

/* ==================================================================
   TEACHERS — DELETE (single)
================================================================== */
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
        id: teacher.id,
        name: teacher.name,
        staffNo: teacher.staff_no
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
   TEACHERS — BULK DELETE
================================================================== */
router.post('/teachers/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ message: 'No teacher IDs provided' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const placeholders = ids.map(() => '?').join(',');

    const [rows] = await conn.execute(
      `SELECT id, user_id, name FROM teachers WHERE id IN (${placeholders})`,
      ids
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'No matching teachers found' });
    }

    await conn.execute(
      `UPDATE classes SET teacher_id = NULL WHERE teacher_id IN (${placeholders})`,
      ids
    );

    await conn.execute(
      `DELETE FROM teachers WHERE id IN (${placeholders})`,
      ids
    );

    const userIds = rows.map((r) => r.user_id).filter(Boolean);
    if (userIds.length) {
      const uPlaceholders = userIds.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM users WHERE id IN (${uPlaceholders})`,
        userIds
      );
    }

    await conn.commit();
    res.json({
      message: `${rows.length} teacher(s) removed`,
      removed: rows.map((r) => r.name)
    });
  } catch (err) {
    await conn.rollback();
    console.error('Bulk delete teachers failed:', err);
    res.status(500).json({ message: err.message || 'Bulk delete failed' });
  } finally {
    conn.release();
  }
});

/* ==================================================================
   TEACHERS — BULK IMPORT
================================================================== */
router.post('/teachers/bulk-import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let rows;
  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  } catch (err) {
    return res.status(400).json({ message: 'Could not read file: ' + err.message });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'Spreadsheet is empty' });
  }

  const created = [];
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = normalizeRow(rows[i]);
    const line = i + 2;

    const name = row.name;
    const email = (row.email || '').toLowerCase();
    const password = row.password || 'changeme123';
    const formClass = row.formclass || '';
    const subjectsRaw = row.subjects || '';

    if (!name || !email) {
      failed.push({ line, name, email, reason: 'name and email are required' });
      continue;
    }

    const subjectList = Array.isArray(subjectsRaw)
      ? subjectsRaw
      : String(subjectsRaw).split(',').map((s) => s.trim()).filter(Boolean);

    try {
      const [taken] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      if (taken.length) {
        failed.push({ line, name, email, reason: 'Email already exists' });
        continue;
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [uResult] = await conn.execute(
          'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
          [name, email, password, 'teacher']
        );
        const userId = uResult.insertId;

        const [[{ maxId }]] = await conn.execute('SELECT MAX(id) AS maxId FROM teachers');
        const newId = (maxId || 0) + 1;
        const staffNo = `TCH/${String(newId).padStart(3, '0')}`;

        const [tResult] = await conn.execute(
          `INSERT INTO teachers
            (user_id, name, staff_no, email, phone, subjects,
             form_class, qualification, address, joined)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
          [
            userId, name, staffNo, email,
            row.phone || '',
            JSON.stringify(subjectList),
            formClass || 'Unassigned',
            row.qualification || '',
            row.address || ''
          ]
        );

        if (formClass.trim()) {
          const [cls] = await conn.execute(
            'SELECT id, subjects FROM classes WHERE name = ?',
            [formClass.trim()]
          );
          if (cls.length) {
            await conn.execute(
              `UPDATE classes
               SET teacher_id = ?,
                   subjects = CASE
                     WHEN subjects IS NULL OR subjects = '' OR subjects = '[]'
                     THEN ?
                     ELSE subjects
                   END
               WHERE id = ?`,
              [tResult.insertId, JSON.stringify(subjectList), cls[0].id]
            );
          } else {
            await conn.execute(
              `INSERT INTO classes (name, teacher_id, subjects, schedule)
               VALUES (?, ?, ?, ?)`,
              [formClass.trim(), tResult.insertId, JSON.stringify(subjectList), JSON.stringify([])]
            );
          }
        }

        await conn.commit();
        created.push({ name, email, formClass, staffNo });
      } catch (innerErr) {
        await conn.rollback();
        throw innerErr;
      } finally {
        conn.release();
      }
    } catch (err) {
      failed.push({ line, name, email, reason: err.message });
    }
  }

  res.json({
    message: `${created.length} teacher(s) imported, ${failed.length} failed`,
    totalRows: rows.length,
    created,
    failed
  });
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
  res.json(rows.map((r) => {
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
  const [quizzes] = await pool.execute('SELECT id, title, subject, class_name, questions, due_date FROM quizzes');
  const [submissions] = await pool.execute('SELECT * FROM quiz_submissions');

  const studentRows = students.map((s) => {
    const mySubs = submissions.filter((sub) => sub.student_id === s.id);
    const totalScore = mySubs.reduce((sum, sub) => sum + sub.score, 0);
    const totalQuestions = mySubs.reduce((sum, sub) => sum + sub.total, 0);
    const average = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0;
    return {
      id: s.id, name: s.name, className: s.class_name,
      quizzesTaken: mySubs.length,
      totalQuizzes: quizzes.filter((q) => q.class_name === s.class_name).length,
      score: totalScore, totalQuestions, average,
    };
  });

  const quizRows = quizzes.map((q) => ({
    id: q.id, title: q.title, subject: q.subject, className: q.class_name,
    questionCount: JSON.parse(q.questions || '[]').length,
    dueDate: q.due_date,
    submissionCount: submissions.filter((s) => s.quiz_id === q.id).length,
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
    link: '/home',
  });

  const [rows] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Announcement posted', announcement: rows[0] });
});

module.exports = router;