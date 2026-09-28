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
    /* ---------- library_resources ---------- */
    if (await tableExists(conn, 'library_resources')) {
      console.log('   ⏭  library_resources (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`library_resources\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`title\` varchar(255) NOT NULL,
          \`type\` enum('book','pdf','article','video','link','past_question')
                    NOT NULL DEFAULT 'book',
          \`subject\` varchar(100) DEFAULT NULL,
          \`class_name\` varchar(50) DEFAULT NULL,
          \`author\` varchar(255) DEFAULT NULL,
          \`description\` text,
          \`url\` varchar(500) DEFAULT NULL,
          \`cover_url\` varchar(500) DEFAULT NULL,
          \`uploaded_by\` int(11) DEFAULT NULL,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`subject_class\` (\`subject\`,\`class_name\`),
          KEY \`type\` (\`type\`),
          FOREIGN KEY (\`uploaded_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  library_resources created');
    }

    /* ---------- library_bookmarks ---------- */
    if (await tableExists(conn, 'library_bookmarks')) {
      console.log('   ⏭  library_bookmarks (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`library_bookmarks\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`resource_id\` int(11) NOT NULL,
          \`list\` enum('reading','favourite','archive') NOT NULL DEFAULT 'reading',
          \`progress\` int(11) NOT NULL DEFAULT 0,
          \`notes\` text,
          \`added_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_user_resource\` (\`user_id\`,\`resource_id\`),
          KEY \`user_list\` (\`user_id\`,\`list\`),
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
          FOREIGN KEY (\`resource_id\`) REFERENCES \`library_resources\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  library_bookmarks created');
    }

    /* ---------- onboarding_state ---------- */
    if (await tableExists(conn, 'onboarding_state')) {
      console.log('   ⏭  onboarding_state (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`onboarding_state\` (
          \`user_id\` int(11) NOT NULL,
          \`tour_completed\` tinyint(1) NOT NULL DEFAULT 0,
          \`tour_completed_at\` datetime DEFAULT NULL,
          \`dismissed_tips\` text,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`user_id\`),
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  onboarding_state created');
    }

    console.log('\n✅ Batch 7 schema ready\n');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error('\n❌ Failed:', e.message);
  process.exitCode = 1;
});