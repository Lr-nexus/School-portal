const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');

router.use(protect);

/* Helper — always store smaller ID first so a pair is unique */
const pair = (a, b) => (a < b ? [a, b] : [b, a]);

/* ============================================================
   GET /api/messages/conversations
   Lists all conversations the current user is part of,
   with the other user's name, last message, unread count.
   ============================================================ */
router.get('/conversations', async (req, res) => {
  const me = req.user.id;

  const [rows] = await pool.execute(
    `SELECT
       c.id, c.user1_id, c.user2_id, c.last_message_at,
       u1.name AS user1_name, u1.role AS user1_role,
       u2.name AS user2_name, u2.role AS user2_role
     FROM conversations c
     JOIN users u1 ON u1.id = c.user1_id
     JOIN users u2 ON u2.id = c.user2_id
     WHERE c.user1_id = ? OR c.user2_id = ?
     ORDER BY c.last_message_at DESC`,
    [me, me]
  );

  const result = [];
  for (const c of rows) {
    const otherId = c.user1_id === me ? c.user2_id : c.user1_id;
    const otherName = c.user1_id === me ? c.user2_name : c.user1_name;
    const otherRole = c.user1_id === me ? c.user2_role : c.user1_role;

    const [[lastMsg]] = await pool.execute(
      `SELECT body, created_at FROM messages
       WHERE conversation_id = ?
       ORDER BY id DESC LIMIT 1`,
      [c.id]
    );

    const [[{ unread }]] = await pool.execute(
      `SELECT COUNT(*) AS unread FROM messages
       WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`,
      [c.id, me]
    );

    result.push({
      id: c.id,
      otherUserId: otherId,
      otherName,
      otherRole,
      lastMessage: lastMsg?.body || '',
      lastMessageAt: lastMsg?.created_at || c.last_message_at,
      unreadCount: Number(unread),
    });
  }

  res.json(result);
});

/* ============================================================
   POST /api/messages/conversations
   Start (or reuse) a conversation with another user
   body: { otherUserId }
   ============================================================ */
router.post('/conversations', async (req, res) => {
  const me = req.user.id;
  const other = Number(req.body.otherUserId);

  if (!other || other === me) {
    return res.status(400).json({ message: 'A valid otherUserId is required' });
  }

  const [u] = await pool.execute('SELECT id FROM users WHERE id = ?', [other]);
  if (!u.length) return res.status(404).json({ message: 'User not found' });

  const [a, b] = pair(me, other);

  const [existing] = await pool.execute(
    'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
    [a, b]
  );

  if (existing.length) return res.json({ conversationId: existing[0].id });

  const [result] = await pool.execute(
    'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)',
    [a, b]
  );

  res.status(201).json({ conversationId: result.insertId });
});

/* ============================================================
   GET /api/messages/conversations/:id
   Load message history + mark unread messages as read
   ============================================================ */
router.get('/conversations/:id', async (req, res) => {
  const me = req.user.id;
  const id = Number(req.params.id);

  const [convRows] = await pool.execute(
    `SELECT c.*, u1.name AS user1_name, u1.role AS user1_role,
            u2.name AS user2_name, u2.role AS user2_role
     FROM conversations c
     JOIN users u1 ON u1.id = c.user1_id
     JOIN users u2 ON u2.id = c.user2_id
     WHERE c.id = ? AND (c.user1_id = ? OR c.user2_id = ?)`,
    [id, me, me]
  );
  if (!convRows.length) return res.status(404).json({ message: 'Conversation not found' });

  const c = convRows[0];
  const otherId = c.user1_id === me ? c.user2_id : c.user1_id;
  const otherName = c.user1_id === me ? c.user2_name : c.user1_name;
  const otherRole = c.user1_id === me ? c.user2_role : c.user1_role;

  const [messages] = await pool.execute(
    `SELECT id, sender_id, body, created_at
     FROM messages WHERE conversation_id = ?
     ORDER BY id ASC`,
    [id]
  );

  // Mark other user's messages as read
  await pool.execute(
    'UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL',
    [id, me]
  );

  res.json({
    id: c.id,
    otherUserId: otherId,
    otherName,
    otherRole,
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      mine: m.sender_id === me,
    })),
  });
});

/* ============================================================
   POST /api/messages/conversations/:id/send
   body: { body }
   ============================================================ */
router.post('/conversations/:id/send', async (req, res) => {
  const me = req.user.id;
  const id = Number(req.params.id);
  const text = String(req.body.body || '').trim();

  if (!text) return res.status(400).json({ message: 'Message cannot be empty' });

  const [convRows] = await pool.execute(
    'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [id, me, me]
  );
  if (!convRows.length) return res.status(404).json({ message: 'Conversation not found' });

  const [result] = await pool.execute(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
    [id, me, text]
  );

  await pool.execute(
    'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
    [id]
  );

  const [rows] = await pool.execute(
    'SELECT id, sender_id, body, created_at FROM messages WHERE id = ?',
    [result.insertId]
  );
  const m = rows[0];

  res.status(201).json({
    message: {
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      mine: true,
    },
  });
});

/* ============================================================
   GET /api/messages/contacts
   Who can I message? Based on role.
   ============================================================ */
router.get('/contacts', async (req, res) => {
  const me = req.user.id;
  const role = req.user.role;
  const contacts = [];

  try {
    if (role === 'student') {
      // Students can message: teachers of their class, admins, parents
      const [studentRows] = await pool.execute(
        'SELECT class_name, parent_id FROM students WHERE user_id = ?',
        [me]
      );
      if (studentRows.length) {
        const { class_name, parent_id } = studentRows[0];

        const [teachers] = await pool.execute(
          `SELECT u.id, u.name, u.role, t.staff_no AS sub
           FROM users u
           JOIN teachers t ON t.user_id = u.id
           JOIN classes c ON c.teacher_id = t.id
           WHERE c.name = ?`,
          [class_name]
        );
        contacts.push(...teachers.map((t) => ({
          id: t.id, name: t.name, role: t.role, detail: t.sub,
        })));

        const [admins] = await pool.execute(
          `SELECT u.id, u.name, u.role, a.title AS sub
           FROM users u JOIN admins a ON a.user_id = u.id`
        );
        contacts.push(...admins.map((a) => ({
          id: a.id, name: a.name, role: a.role, detail: a.sub,
        })));

        if (parent_id) {
          const [parents] = await pool.execute(
            'SELECT user_id AS id, name, "parent" AS role, relationship AS sub FROM parents WHERE id = ?',
            [parent_id]
          );
          contacts.push(...parents);
        }
      }
    } else if (role === 'teacher') {
      // Teachers: students in their classes, other teachers, admins, parents of their students
      const [teacherRows] = await pool.execute(
        'SELECT id FROM teachers WHERE user_id = ?',
        [me]
      );
      if (teacherRows.length) {
        const [students] = await pool.execute(
          `SELECT u.id, u.name, u.role, s.admission_no AS sub
           FROM users u
           JOIN students s ON s.user_id = u.id
           JOIN classes c ON c.name = s.class_name
           WHERE c.teacher_id = ?`,
          [teacherRows[0].id]
        );
        contacts.push(...students.map((s) => ({
          id: s.id, name: s.name, role: s.role, detail: s.sub,
        })));

        const [parents] = await pool.execute(
          `SELECT DISTINCT u.id, u.name, u.role, p.relationship AS sub
           FROM users u
           JOIN parents p ON p.user_id = u.id
           JOIN students s ON s.parent_id = p.id
           JOIN classes c ON c.name = s.class_name
           WHERE c.teacher_id = ?`,
          [teacherRows[0].id]
        );
        contacts.push(...parents.map((p) => ({
          id: p.id, name: p.name, role: p.role, detail: p.sub,
        })));
      }

      const [otherTeachers] = await pool.execute(
        `SELECT u.id, u.name, u.role, t.staff_no AS sub
         FROM users u JOIN teachers t ON t.user_id = u.id
         WHERE u.id != ?`,
        [me]
      );
      contacts.push(...otherTeachers.map((t) => ({
        id: t.id, name: t.name, role: t.role, detail: t.sub,
      })));

      const [admins] = await pool.execute(
        `SELECT u.id, u.name, u.role, a.title AS sub
         FROM users u JOIN admins a ON a.user_id = u.id`
      );
      contacts.push(...admins.map((a) => ({
        id: a.id, name: a.name, role: a.role, detail: a.sub,
      })));
    } else if (role === 'parent') {
      // Parents: their child's teachers + admins
      const [childRows] = await pool.execute(
        `SELECT s.class_name
         FROM students s
         JOIN parents p ON p.id = s.parent_id
         WHERE p.user_id = ? LIMIT 1`,
        [me]
      );
      if (childRows.length) {
        const [teachers] = await pool.execute(
          `SELECT u.id, u.name, u.role, t.staff_no AS sub
           FROM users u
           JOIN teachers t ON t.user_id = u.id
           JOIN classes c ON c.teacher_id = t.id
           WHERE c.name = ?`,
          [childRows[0].class_name]
        );
        contacts.push(...teachers.map((t) => ({
          id: t.id, name: t.name, role: t.role, detail: t.sub,
        })));
      }

      const [admins] = await pool.execute(
        `SELECT u.id, u.name, u.role, a.title AS sub
         FROM users u JOIN admins a ON a.user_id = u.id`
      );
      contacts.push(...admins.map((a) => ({
        id: a.id, name: a.name, role: a.role, detail: a.sub,
      })));
    } else if (role === 'admin') {
      // Admins: everyone
      const [all] = await pool.execute(
        'SELECT id, name, role FROM users WHERE id != ? ORDER BY name',
        [me]
      );
      contacts.push(...all.map((u) => ({
        id: u.id, name: u.name, role: u.role, detail: '',
      })));
    }

    // De-dupe by id
    const seen = new Set();
    const unique = contacts.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    res.json(unique);
  } catch (err) {
    console.error('Contacts failed:', err);
    res.status(500).json({ message: err.message || 'Failed to load contacts' });
  }
});

module.exports = router;