/* ------------------------------------------------------------------
   Upgrade script — adds missing columns, tables, keys, enums.
   Safe to run repeatedly. Never drops data.

   Run:   node scripts/upgrade.js
   ------------------------------------------------------------------ */

require('dotenv').config();
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME;

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [dbName, table, column]
  );
  return rows.length > 0;
}
async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [dbName, table]
  );
  return rows.length > 0;
}
async function addColumn(conn, table, column, definition) {
  if (!(await tableExists(conn, table))) {
    console.log(`   ⏭  ${table} (table missing)`); return;
  }
  if (await columnExists(conn, table, column)) {
    console.log(`   ⏭  ${table}.${column} (exists)`); return;
  }
  try {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
    console.log(`   ✓  ${table}.${column} added`);
  } catch (err) {
    console.log(`   ✗  ${table}.${column} failed: ${err.message}`);
  }
}
async function modifyEnum(conn, table, column, values) {
  if (!(await tableExists(conn, table))) return;
  const list = values.map((v) => `'${v}'`).join(',');
  try {
    await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${list}) NOT NULL`);
    console.log(`   ✓  ${table}.${column} → [${values.join(', ')}]`);
  } catch (err) {
    console.log(`   ✗  ${table}.${column} enum failed: ${err.message}`);
  }
}
async function addUniqueKey(conn, table, keyName, columns) {
  if (!(await tableExists(conn, table))) return;
  try {
    const [rows] = await conn.query(
      `SELECT index_name FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
      [dbName, table, keyName]
    );
    if (rows.length) { console.log(`   ⏭  ${table}.${keyName} (exists)`); return; }
    await conn.query(
      `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${keyName}\` (${columns
        .map((c) => `\`${c}\``).join(', ')})`
    );
    console.log(`   ✓  ${table}.${keyName} added`);
  } catch (err) {
    console.log(`   ⚠️  ${table}.${keyName} skipped: ${err.message}`);
  }
}
async function createTableIfMissing(conn, table, sql) {
  if (await tableExists(conn, table)) {
    console.log(`   ⏭  ${table} (exists)`); return;
  }
  try {
    await conn.query(sql);
    console.log(`   ✓  ${table} created`);
  } catch (err) {
    console.log(`   ✗  ${table} failed: ${err.message}`);
  }
}

async function upgrade() {
  console.log('🔧 Upgrading existing tables…\n');
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

    console.log('─── Columns ────────────────────────────');
    await addColumn(conn, 'students', 'parent_id', 'int(11) DEFAULT NULL');
    await addColumn(conn, 'students', 'photo', 'varchar(500) DEFAULT NULL');
    await addColumn(conn, 'teachers', 'photo', 'varchar(500) DEFAULT NULL');
    await addColumn(conn, 'admins', 'photo', 'varchar(500) DEFAULT NULL');
    await addColumn(conn, 'parents', 'photo', 'varchar(500) DEFAULT NULL');
    await addColumn(conn, 'announcements', 'category', "varchar(50) DEFAULT 'General'");
    await addColumn(conn, 'class_sessions', 'teacher_name', 'varchar(255) DEFAULT NULL');
    await addColumn(conn, 'teachers', 'teacher_type',
      "enum('class_teacher','subject_teacher') NOT NULL DEFAULT 'class_teacher'");

    console.log('\n─── Unique keys ────────────────────────');
    await addUniqueKey(conn, 'results', 'student_session_term_subject',
      ['student_id', 'session', 'term', 'subject']);
    await addUniqueKey(conn, 'attendance', 'student_date', ['student_id', 'date']);
    await addUniqueKey(conn, 'assignment_submissions', 'assign_student',
      ['assignment_id', 'student_id']);
    await addUniqueKey(conn, 'quiz_submissions', 'quiz_student',
      ['quiz_id', 'student_id']);
    await addUniqueKey(conn, 'conversations', 'pair', ['user1_id', 'user2_id']);

    console.log('\n─── Enums ──────────────────────────────');
    await modifyEnum(conn, 'users', 'role', ['student', 'teacher', 'admin', 'parent']);

    console.log('\n─── New tables ─────────────────────────');
    await createTableIfMissing(conn, 'teacher_assignments', `
      CREATE TABLE \`teacher_assignments\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`teacher_id\` int(11) NOT NULL,
        \`class_name\` varchar(50) NOT NULL,
        \`subject\` varchar(100) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`teacher_class_subject\` (\`teacher_id\`,\`class_name\`,\`subject\`),
        FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('\n✅ Upgrade complete\n');
  } catch (err) {
    console.error('\n❌ Upgrade failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

upgrade();