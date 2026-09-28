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
    if (await tableExists(conn, 'audit_log')) {
      console.log('   ⏭  audit_log (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`audit_log\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) DEFAULT NULL,
          \`user_name\` varchar(255) DEFAULT NULL,
          \`user_role\` varchar(20) DEFAULT NULL,
          \`method\` varchar(10) NOT NULL,
          \`path\` varchar(500) NOT NULL,
          \`resource\` varchar(100) DEFAULT NULL,
          \`entity_id\` int(11) DEFAULT NULL,
          \`status\` int(11) NOT NULL,
          \`ip\` varchar(50) DEFAULT NULL,
          \`user_agent\` varchar(255) DEFAULT NULL,
          \`meta\` text,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`user_created\` (\`user_id\`, \`created_at\`),
          KEY \`resource_created\` (\`resource\`, \`created_at\`),
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('   ✓  audit_log created');
    }

    console.log('\n✅ Batch 6 schema ready\n');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error('\n❌ Failed:', e.message);
  process.exitCode = 1;
});