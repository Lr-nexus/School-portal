require('dotenv').config();
const mysql = require('mysql2/promise');

async function tableExists(conn, table) {
  const [r] = await conn.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [process.env.DB_NAME, table]
  );
  return r.length > 0;
}

async function run() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('DB_HOST, DB_USER and DB_NAME must be set in .env');
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  try {
    /* ---------- push_subscriptions ---------- */
    if (await tableExists(conn, 'push_subscriptions')) {
      console.log('   ⏭  push_subscriptions (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`push_subscriptions\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`endpoint\` varchar(500) NOT NULL,
          \`p256dh\` varchar(255) NOT NULL,
          \`auth\` varchar(255) NOT NULL,
          \`user_agent\` varchar(255) DEFAULT NULL,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`last_used_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`endpoint\` (\`endpoint\`(191)),
          KEY \`user_id\` (\`user_id\`),
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  push_subscriptions created');
    }

    /* ---------- reminder_log ---------- */
    if (await tableExists(conn, 'reminder_log')) {
      console.log('   ⏭  reminder_log (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`reminder_log\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`kind\` varchar(50) NOT NULL,
          \`entity_type\` varchar(50) NOT NULL,
          \`entity_id\` int(11) NOT NULL,
          \`user_id\` int(11) NOT NULL,
          \`channel\` enum('in_app','push','email') NOT NULL,
          \`sent_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_send\` (\`kind\`,\`entity_type\`,\`entity_id\`,\`user_id\`,\`channel\`),
          KEY \`user_kind\` (\`user_id\`,\`kind\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  reminder_log created');
    }

    /* ---------- notification_prefs ---------- */
    if (await tableExists(conn, 'notification_prefs')) {
      console.log('   ⏭  notification_prefs (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`notification_prefs\` (
          \`user_id\` int(11) NOT NULL,
          \`push_enabled\` tinyint(1) NOT NULL DEFAULT 1,
          \`email_digest_enabled\` tinyint(1) NOT NULL DEFAULT 1,
          \`digest_frequency\` enum('daily','weekly','off') NOT NULL DEFAULT 'daily',
          \`deadline_reminders\` tinyint(1) NOT NULL DEFAULT 1,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`user_id\`),
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  notification_prefs created');
    }

    console.log('\n✅ Batch 5 schema ready\n');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error('\n❌ Failed:', e.message);
  process.exitCode = 1;
});