const router = require('express').Router();
const pool = require('../db');
const { protect } = require('../middleware/auth');
const { notify, notifyClassStudents } = require('../utils/notify');

router.use(protect);

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

/* ============================================================
   GET /api/messages/conversations
   Returns BOTH direct conversations AND group chats merged.
   ============================================================ */
router.get('/conversations', async (req, res) => {
  const me = req.user.id;
  const out = [];

  /* ---------- Direct ---------- */
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

  for (const c of rows) {
    const otherId = c.user1_id === me ? c.user2_id : c.user1_id;
    const otherName = c.user1_id === me ? c.user2_name : c.user1_name;
    const otherRole = c.user1_id === me ? c.user2_role : c.user1_role;

    const [[lastMsg]] = await pool.execute(
      `SELECT body, created_at, sender_id, read_at FROM messages
       WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`,
      [c.id]
    );

    const [[{ unread }]] = await pool.execute(
      `SELECT COUNT(*) AS unread FROM messages
       WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`,
      [c.id, me]
    );

    // For the sender's own last message, we want its read status
    const lastMine = lastMsg?.sender_id === me;
    const lastRead = lastMine ? !!lastMsg?.read_at : false;

    out.push({
      kind: 'direct',
      id: `direct-${c.id}`,
      rawId: c.id,
      otherUserId: otherId,
      otherName,
      otherRole,
      lastMessage: lastMsg?.body || '',
      lastMessageAt: lastMsg?.created_at || c.last_message_at,
      lastMine,
      lastRead,
      unreadCount: Number(unread),
    });
  }

  /* ---------- Groups ---------- */
  const [groups] = await pool.execute(
    `SELECT g.*,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
     FROM group_conversations g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ?
     ORDER BY g.created_at DESC`,
    [me]
  );

  for (const g of groups) {
    const [[lastMsg]] = await pool.execute(
      `SELECT gm.id, gm.body, gm.created_at, gm.sender_id, u.name AS sender_name
       FROM group_messages gm
       JOIN users u ON u.id = gm.sender_id
       WHERE gm.group_id = ?
       ORDER BY gm.id DESC LIMIT 1`,
      [g.id]
    );

    // Unread = messages I didn't send that don't have a read row for me
    const [[{ unread }]] = await pool.execute(
      `SELECT COUNT(*) AS unread FROM group_messages gm
       WHERE gm.group_id = ?
         AND gm.sender_id != ?
         AND NOT EXISTS (
           SELECT 1 FROM group_message_reads r
           WHERE r.message_id = gm.id AND r.user_id = ?
         )`,
      [g.id, me, me]
    );

    out.push({
      kind: 'group',
      id: `group-${g.id}`,
      rawId: g.id,
      name: g.name,
      className: g.class_name,
      memberCount: Number(g.member_count),
      lastMessage: lastMsg?.body || '',
      lastMessageAt: lastMsg?.created_at || g.created_at,
      lastSender: lastMsg?.sender_name || null,
      unreadCount: Number(unread),
    });
  }

  out.sort(
    (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
  );

  res.json(out);
});

/* ============================================================
   POST /api/messages/conversations  (start direct chat)
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
   GET /api/messages/conversations/:id  (direct thread)
   Returns messages with `readAt` so sender sees ✓✓
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
    `SELECT id, sender_id, body, created_at, read_at
     FROM messages WHERE conversation_id = ? ORDER BY id ASC`,
    [id]
  );

  // Mark all incoming as read
  await pool.execute(
    `UPDATE messages SET read_at = NOW()
     WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`,
    [id, me]
  );

  res.json({
    kind: 'direct',
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
      // ⭐ Sent read receipt info: was it read by the OTHER person?
      readAt: m.sender_id === me ? m.read_at : null,
    })),
  });
});

/* ============================================================
   POST /api/messages/conversations/:id/send
   ============================================================ */
router.post('/conversations/:id/send', async (req, res) => {
  const me = req.user.id;
  const id = Number(req.params.id);
  const text = String(req.body.body || '').trim();
  if (!text) return res.status(400).json({ message: 'Message cannot be empty' });

  const [convRows] = await pool.execute(
    'SELECT id, user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [id, me, me]
  );
  if (!convRows.length) return res.status(404).json({ message: 'Conversation not found' });
  const conv = convRows[0];

  const [result] = await pool.execute(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
    [id, me, text]
  );
  await pool.execute(
    'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
    [id]
  );

  const [rows] = await pool.execute(
    'SELECT id, sender_id, body, created_at, read_at FROM messages WHERE id = ?',
    [result.insertId]
  );
  const m = rows[0];

  // Notify the recipient
  try {
    const recipientId = conv.user1_id === me ? conv.user2_id : conv.user1_id;
    const [recipientRows] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [recipientId]
    );
    if (recipientRows.length && recipientRows[0].id !== me) {
      const rec = recipientRows[0];
      const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;
      await notify({
        userId: rec.id,
        type: 'message',
        title: `New message from ${req.user.name}`,
        body: preview,
        link: `/${rec.role}/messages`,
      });
    }
  } catch (e) {
    console.error('Notify failed:', e.message);
  }

  res.status(201).json({
    message: {
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      mine: true,
      readAt: null,
    },
  });
});

/* ============================================================
   GROUP — fetch or create the class group for me
   ============================================================ */
router.get('/groups/class', async (req, res) => {
  const me = req.user.id;
  const role = req.user.role;

  let className = null;
  if (role === 'student') {
    const [s] = await pool.execute(
      'SELECT class_name FROM students WHERE user_id = ?',
      [me]
    );
    className = s[0]?.class_name;
  } else if (role === 'teacher') {
    const [t] = await pool.execute(
      'SELECT form_class FROM teachers WHERE user_id = ?',
      [me]
    );
    className = t[0]?.form_class;
  }

  if (!className) {
    return res.status(404).json({ message: 'No class assigned' });
  }

  const [existing] = await pool.execute(
    `SELECT id FROM group_conversations WHERE class_name = ? AND kind = 'class' LIMIT 1`,
    [className]
  );

  let groupId;
  if (existing.length) {
    groupId = existing[0].id;
  } else {
    const [result] = await pool.execute(
      `INSERT INTO group_conversations (name, kind, class_name, created_by)
       VALUES (?, 'class', ?, ?)`,
      [`${className} Class Chat`, className, me]
    );
    groupId = result.insertId;
  }

  // Make sure I'm a member
  await pool.execute(
    `INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`,
    [groupId, me]
  );

  res.json({ groupId, className });
});

/* ============================================================
   GROUP — list groups I'm in
   ============================================================ */
router.get('/groups', async (req, res) => {
  const me = req.user.id;
  const [rows] = await pool.execute(
    `SELECT g.*,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
     FROM group_conversations g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ?
     ORDER BY g.created_at DESC`,
    [me]
  );
  res.json(rows);
});

/* ============================================================
   GROUP — fetch thread + mark all as read
   ============================================================ */
router.get('/groups/:id', async (req, res) => {
  const me = req.user.id;
  const id = Number(req.params.id);

  const [groupRows] = await pool.execute(
    `SELECT g.* FROM group_conversations g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE g.id = ? AND gm.user_id = ?`,
    [id, me]
  );
  if (!groupRows.length) return res.status(404).json({ message: 'Group not found' });

  const g = groupRows[0];

  const [members] = await pool.execute(
    `SELECT u.id, u.name, u.role
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?
     ORDER BY u.name`,
    [id]
  );

  const [messages] = await pool.execute(
    `SELECT gm.id, gm.sender_id, gm.body, gm.created_at, u.name AS sender_name, u.role AS sender_role
     FROM group_messages gm
     JOIN users u ON u.id = gm.sender_id
     WHERE gm.group_id = ?
     ORDER BY gm.id ASC`,
    [id]
  );

  // Read receipts: get all reads for these messages
  const msgIds = messages.map((m) => m.id);
  let reads = [];
  if (msgIds.length) {
    const ph = msgIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT message_id, user_id FROM group_message_reads WHERE message_id IN (${ph})`,
      msgIds
    );
    reads = rows;
  }

  // Mark all messages as read for me
  for (const m of messages) {
    if (m.sender_id !== me) {
      await pool.execute(
        `INSERT IGNORE INTO group_message_reads (message_id, user_id) VALUES (?, ?)`,
        [m.id, me]
      );
    }
  }

  res.json({
    kind: 'group',
    id: g.id,
    name: g.name,
    className: g.class_name,
    members: members.map((mm) => ({
      id: mm.id, name: mm.name, role: mm.role,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderRole: m.sender_role,
      body: m.body,
      createdAt: m.created_at,
      mine: m.sender_id === me,
      // For my own messages, count how many others have read it
      readCount: reads.filter(
        (r) => r.message_id === m.id && r.user_id !== me
      ).length,
    })),
  });
});

/* ============================================================
   GROUP — send message
   ============================================================ */
router.post('/groups/:id/send', async (req, res) => {
  const me = req.user.id;
  const id = Number(req.params.id);
  const text = String(req.body.body || '').trim();
  if (!text) return res.status(400).json({ message: 'Message cannot be empty' });

  const [memberRows] = await pool.execute(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
    [id, me]
  );
  if (!memberRows.length) {
    return res.status(403).json({ message: 'Not a member of this group' });
  }

  const [result] = await pool.execute(
    `INSERT INTO group_messages (group_id, sender_id, body) VALUES (?, ?, ?)`,
    [id, me, text]
  );

  const [rows] = await pool.execute(
    `SELECT gm.id, gm.sender_id, gm.body, gm.created_at, u.name AS sender_name, u.role AS sender_role
     FROM group_messages gm
     JOIN users u ON u.id = gm.sender_id
     WHERE gm.id = ?`,
    [result.insertId]
  );
  const m = rows[0];

  // Notify other members
  try {
    const [members] = await pool.execute(
      `SELECT u.id, u.role FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ? AND gm.user_id != ?`,
      [id, me]
    );
    const [groupRow] = await pool.execute(
      'SELECT name FROM group_conversations WHERE id = ?',
      [id]
    );
    const groupName = groupRow[0]?.name || 'Group';
    const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;

    for (const mem of members) {
      await notify({
        userId: mem.id,
        type: 'message',
        title: `${groupName} — ${req.user.name}`,
        body: preview,
        link: `/${mem.role}/messages`,
      });
    }
  } catch (e) {
    console.error('Group notify failed:', e.message);
  }

  res.status(201).json({
    message: {
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderRole: m.sender_role,
      body: m.body,
      createdAt: m.created_at,
      mine: true,
      readCount: 0,
    },
  });
});

/* ============================================================
   GET /api/messages/contacts  (unchanged)
   ============================================================ */
router.get('/contacts', async (req, res) => {
  const me = req.user.id;
  const role = req.user.role;
  const contacts = [];

  try {
    if (role === 'student') {
      const [sRows] = await pool.execute(
        'SELECT class_name, parent_id FROM students WHERE user_id = ?', [me]
      );
      if (sRows.length) {
        const { class_name, parent_id } = sRows[0];
        const [teachers] = await pool.execute(
          `SELECT u.id, u.name, u.role, t.staff_no AS sub
           FROM users u JOIN teachers t ON t.user_id = u.id
           JOIN classes c ON c.teacher_id = t.id
           WHERE c.name = ?`, [class_name]
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
      const [tRows] = await pool.execute(
        'SELECT id FROM teachers WHERE user_id = ?', [me]
      );
      if (tRows.length) {
        const [students] = await pool.execute(
          `SELECT u.id, u.name, u.role, s.admission_no AS sub
           FROM users u JOIN students s ON s.user_id = u.id
           JOIN classes c ON c.name = s.class_name
           WHERE c.teacher_id = ?`, [tRows[0].id]
        );
        contacts.push(...students.map((s) => ({
          id: s.id, name: s.name, role: s.role, detail: s.sub,
        })));
        const [parents] = await pool.execute(
          `SELECT DISTINCT u.id, u.name, u.role, p.relationship AS sub
           FROM users u JOIN parents p ON p.user_id = u.id
           JOIN students s ON s.parent_id = p.id
           JOIN classes c ON c.name = s.class_name
           WHERE c.teacher_id = ?`, [tRows[0].id]
        );
        contacts.push(...parents.map((p) => ({
          id: p.id, name: p.name, role: p.role, detail: p.sub,
        })));
      }
      const [otherTeachers] = await pool.execute(
        `SELECT u.id, u.name, u.role, t.staff_no AS sub
         FROM users u JOIN teachers t ON t.user_id = u.id WHERE u.id != ?`, [me]
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
      const [childRows] = await pool.execute(
        `SELECT s.class_name FROM students s
         JOIN parents p ON p.id = s.parent_id
         WHERE p.user_id = ? LIMIT 1`, [me]
      );
      if (childRows.length) {
        const [teachers] = await pool.execute(
          `SELECT u.id, u.name, u.role, t.staff_no AS sub
           FROM users u JOIN teachers t ON t.user_id = u.id
           JOIN classes c ON c.teacher_id = t.id
           WHERE c.name = ?`, [childRows[0].class_name]
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
      const [all] = await pool.execute(
        'SELECT id, name, role FROM users WHERE id != ? ORDER BY name', [me]
      );
      contacts.push(...all.map((u) => ({
        id: u.id, name: u.name, role: u.role, detail: '',
      })));
    }

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