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
    if (await tableExists(conn, 'meetings')) {
      console.log('   ⏭  meetings (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`meetings\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`parent_id\` int(11) NOT NULL,
          \`teacher_id\` int(11) NOT NULL,
          \`student_id\` int(11) NOT NULL,
          \`topic\` varchar(255) NOT NULL,
          \`message\` text,
          \`preferred_date\` date NOT NULL,
          \`preferred_time\` varchar(10) NOT NULL,
          \`duration_minutes\` int(11) NOT NULL DEFAULT 20,
          \`status\` enum('pending','accepted','declined','rescheduled','completed','cancelled')
                    NOT NULL DEFAULT 'pending',
          \`scheduled_date\` date DEFAULT NULL,
          \`scheduled_time\` varchar(10) DEFAULT NULL,
          \`teacher_response\` text,
          \`completed_notes\` text,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`parent_status\` (\`parent_id\`,\`status\`),
          KEY \`teacher_status\` (\`teacher_id\`,\`status\`),
          FOREIGN KEY (\`parent_id\`) REFERENCES \`parents\`(\`id\`) ON DELETE CASCADE,
          FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE,
          FOREIGN KEY (\`student_id\`) REFERENCES \`students\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  meetings created');
    }

    console.log('\n✅ Batch 4 schema ready\n');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error('\n❌ Failed:', e.message);
  process.exitCode = 1;
});