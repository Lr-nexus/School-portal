/* ------------------------------------------------------------------
   upgrade-batch2.js — adds:
     • group_conversations
     • group_members
     • group_messages
     • group_message_reads
     • behaviour_reports
   Safe to run repeatedly. Never drops data.

   Run:   node scripts/upgrade-batch2.js
   ------------------------------------------------------------------ */

require('dotenv').config();
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME;

async function tableExists(conn, table) {
  const [r] = await conn.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [dbName, table]
  );
  return r.length > 0;
}

async function createTable(conn, table, sql) {
  if (await tableExists(conn, table)) {
    console.log(`   ⏭  ${table} (exists)`);
    return;
  }
  await conn.query(sql);
  console.log(`   ✓  ${table} created`);
}

async function run() {
  console.log('\n🔧 Applying Batch 2 schema…\n');
  console.log(`   DB: ${dbName}\n`);

  if (!process.env.DB_HOST || !process.env.DB_USER || !dbName) {
    console.error('❌ DB_HOST, DB_USER and DB_NAME must be set in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: dbName,
      ssl: { rejectUnauthorized: false },
    });
    console.log('   ✓ Connected\n');

    /* ---------- Group conversations ---------- */
    await createTable(conn, 'group_conversations', `
      CREATE TABLE \`group_conversations\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`kind\` enum('class','custom') NOT NULL DEFAULT 'class',
        \`class_name\` varchar(50) DEFAULT NULL,
        \`created_by\` int(11) DEFAULT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uniq_class\` (\`class_name\`, \`kind\`),
        FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable(conn, 'group_members', `
      CREATE TABLE \`group_members\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`group_id\` int(11) NOT NULL,
        \`user_id\` int(11) NOT NULL,
        \`joined_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uniq_member\` (\`group_id\`,\`user_id\`),
        FOREIGN KEY (\`group_id\`) REFERENCES \`group_conversations\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable(conn, 'group_messages', `
      CREATE TABLE \`group_messages\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`group_id\` int(11) NOT NULL,
        \`sender_id\` int(11) NOT NULL,
        \`body\` text NOT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        FOREIGN KEY (\`group_id\`) REFERENCES \`group_conversations\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`sender_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await createTable(conn, 'group_message_reads', `
      CREATE TABLE \`group_message_reads\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`message_id\` int(11) NOT NULL,
        \`user_id\` int(11) NOT NULL,
        \`read_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uniq_read\` (\`message_id\`,\`user_id\`),
        FOREIGN KEY (\`message_id\`) REFERENCES \`group_messages\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    /* ---------- Behaviour reports ---------- */
    await createTable(conn, 'behaviour_reports', `
      CREATE TABLE \`behaviour_reports\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`student_id\` int(11) NOT NULL,
        \`teacher_id\` int(11) NOT NULL,
        \`type\` enum('positive','negative','neutral') NOT NULL DEFAULT 'positive',
        \`title\` varchar(255) NOT NULL,
        \`note\` text,
        \`date\` date NOT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    /* ---------- Auto-create a class group per existing class ---------- */
    console.log('\n─── Bootstrapping class group chats ────');
    const [classes] = await conn.query('SELECT name FROM classes');
    const [adminRow] = await conn.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );
    const adminId = adminRow[0]?.id || null;

    let created = 0;
    for (const c of classes) {
      const [existing] = await conn.query(
        `SELECT id FROM group_conversations WHERE class_name = ? AND kind = 'class'`,
        [c.name]
      );
      let groupId;
      if (existing.length) {
        groupId = existing[0].id;
      } else {
        const [res] = await conn.query(
          `INSERT INTO group_conversations (name, kind, class_name, created_by)
           VALUES (?, 'class', ?, ?)`,
          [`${c.name} Class Chat`, c.name, adminId]
        );
        groupId = res.insertId;
        created++;
        console.log(`   ✓  Group created for ${c.name}`);
      }

      // Add class teacher
      const [ctRow] = await conn.query(
        `SELECT t.user_id FROM classes c
         JOIN teachers t ON t.id = c.teacher_id
         WHERE c.name = ? LIMIT 1`,
        [c.name]
      );
      if (ctRow.length && ctRow[0].user_id) {
        await conn.query(
          `INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`,
          [groupId, ctRow[0].user_id]
        );
      }

      // Add all students
      const [students] = await conn.query(
        `SELECT user_id FROM students WHERE class_name = ?`,
        [c.name]
      );
      for (const s of students) {
        await conn.query(
          `INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`,
          [groupId, s.user_id]
        );
      }
    }
    console.log(`   ✓  ${created} new group(s), ${classes.length} total classes processed`);

    console.log('\n✅ Batch 2 schema ready\n');
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();