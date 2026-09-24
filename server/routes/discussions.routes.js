const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');
const { notify, notifyClassStudents } = require('../utils/notify');

router.use(protect);

/* ============================================================
   GET /api/discussions/:assignmentId
   Returns all comments for the assignment.
   Students only see their class's assignments.
   ============================================================ */
router.get('/:assignmentId', async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);

  const [assignmentRows] = await pool.execute(
    'SELECT * FROM assignments WHERE id = ?',
    [assignmentId]
  );
  if (!assignmentRows.length) {
    return res.status(404).json({ message: 'Assignment not found' });
  }
  const a = assignmentRows[0];

  // Students can only view their own class assignments
  if (req.user.role === 'student') {
    const [sRows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (!sRows.length || sRows[0].class_name !== a.class_name) {
      return res.status(403).json({ message: 'Not your class' });
    }
  }

  const [comments] = await pool.execute(
    `SELECT id, user_id, user_name, role, text, parent_id, created_at
     FROM discussion_comments
     WHERE assignment_id = ?
     ORDER BY id ASC`,
    [assignmentId]
  );

  res.json({
    assignment: {
      id: a.id,
      title: a.title,
      className: a.class_name,
      subject: a.subject,
    },
    comments: comments.map((c) => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user_name,
      role: c.role,
      text: c.text,
      parentId: c.parent_id,
      createdAt: c.created_at,
      mine: c.user_id === req.user.id,
    })),
  });
});

/* ============================================================
   POST /api/discussions/:assignmentId
   Add a comment / reply.
   body: { text, parentId? }
   ============================================================ */
router.post('/:assignmentId', async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const text = String(req.body.text || '').trim();
  const parentId = req.body.parentId ? Number(req.body.parentId) : null;

  if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });

  const [assignmentRows] = await pool.execute(
    'SELECT * FROM assignments WHERE id = ?',
    [assignmentId]
  );
  if (!assignmentRows.length) {
    return res.status(404).json({ message: 'Assignment not found' });
  }
  const a = assignmentRows[0];

  if (req.user.role === 'student') {
    const [sRows] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [req.user.id]
    );
    if (!sRows.length || sRows[0].class_name !== a.class_name) {
      return res.status(403).json({ message: 'Not your class' });
    }
  } else if (req.user.role === 'teacher') {
    const [tRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ?',
      [req.user.id]
    );
    if (!tRows.length || tRows[0].id !== a.teacher_id) {
      return res.status(403).json({ message: 'Not your assignment' });
    }
  }

  const [result] = await pool.execute(
    `INSERT INTO discussion_comments
      (assignment_id, user_id, user_name, role, text, parent_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [assignmentId, req.user.id, req.user.name, req.user.role, text, parentId]
  );

  // Notify the other party
  if (req.user.role === 'student') {
    const [tRows] = await pool.execute(
      'SELECT user_id FROM teachers WHERE id = ?',
      [a.teacher_id]
    );
    if (tRows.length && tRows[0].user_id) {
      await notify({
        userId: tRows[0].user_id,
        type: 'discussion',
        title: `New question on "${a.title}"`,
        body: `${req.user.name}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
        link: '/teacher/assignments',
      });
    }
  } else if (req.user.role === 'teacher') {
    // Notify the whole class
    await notifyClassStudents(a.class_name, {
      type: 'discussion',
      title: `New reply from teacher on "${a.title}"`,
      body: `${req.user.name}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
      link: '/student/assignments',
    });
  }

  const [rows] = await pool.execute(
    'SELECT id, user_id, user_name, role, text, parent_id, created_at FROM discussion_comments WHERE id = ?',
    [result.insertId]
  );
  const c = rows[0];

  res.status(201).json({
    message: 'Comment added',
    comment: {
      id: c.id,
      userId: c.user_id,
      userName: c.user_name,
      role: c.role,
      text: c.text,
      parentId: c.parent_id,
      createdAt: c.created_at,
      mine: true,
    },
  });
});

/* ============================================================
   DELETE /api/discussions/:assignmentId/:commentId
   Only the author (or an admin) can delete.
   ============================================================ */
router.delete('/:assignmentId/:commentId', async (req, res) => {
  const commentId = Number(req.params.commentId);

  const [rows] = await pool.execute(
    'SELECT * FROM discussion_comments WHERE id = ? AND assignment_id = ?',
    [commentId, req.params.assignmentId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Comment not found' });

  if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You cannot delete this comment' });
  }

  await pool.execute('DELETE FROM discussion_comments WHERE id = ?', [commentId]);
  res.json({ message: 'Comment deleted' });
});

module.exports = router;