/* ------------------------------------------------------------------
   Upgrade script — adds missing columns to EXISTING tables.
   Does NOT drop anything. Safe to run against production.

   Run with:   node scripts/upgrade.js
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
    console.log(`   ⏭  ${table} (table missing — will be created by migrate.js)`);
    return false;
  }
  if (await columnExists(conn, table, column)) {
    console.log(`   ⏭  ${table}.${column} (already exists)`);
    return false;
  }
  try {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
    console.log(`   ✓  ${table}.${column} added`);
    return true;
  } catch (err) {
    console.log(`   ✗  ${table}.${column} failed: ${err.message}`);
    return false;
  }
}

async function modifyEnum(conn, table, column, values) {
  if (!(await tableExists(conn, table))) return false;
  const list = values.map((v) => `'${v}'`).join(',');
  try {
    await conn.query(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${list}) NOT NULL`
    );
    console.log(`   ✓  ${table}.${column} enum → [${values.join(', ')}]`);
    return true;
  } catch (err) {
    console.log(`   ✗  ${table}.${column} enum failed: ${err.message}`);
    return false;
  }
}

async function addUniqueKey(conn, table, keyName, columns) {
  if (!(await tableExists(conn, table))) return false;
  try {
    const [rows] = await conn.query(
      `SELECT index_name FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
      [dbName, table, keyName]
    );
    if (rows.length) {
      console.log(`   ⏭  ${table}.${keyName} (index exists)`);
      return false;
    }
    await conn.query(
      `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${keyName}\` (${columns
        .map((c) => `\`${c}\``)
        .join(', ')})`
    );
    console.log(`   ✓  ${table}.${keyName} index added`);
    return true;
  } catch (err) {
    console.log(`   ⚠️  ${table}.${keyName} skipped: ${err.message}`);
    return false;
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

    /* ===================== COLUMNS ===================== */

    console.log('─── Adding missing columns ───────────────');

    // students
    await addColumn(conn, 'students', 'parent_id', 'int(11) DEFAULT NULL');
    await addColumn(conn, 'students', 'photo', 'varchar(500) DEFAULT NULL');

    // teachers
    await addColumn(conn, 'teachers', 'photo', 'varchar(500) DEFAULT NULL');

    // admins
    await addColumn(conn, 'admins', 'photo', 'varchar(500) DEFAULT NULL');

    // parents (make sure all needed columns exist)
    await addColumn(conn, 'parents', 'photo', 'varchar(500) DEFAULT NULL');

    // announcements
    await addColumn(conn, 'announcements', 'category', "varchar(50) DEFAULT 'General'");

    // class_sessions
    await addColumn(conn, 'class_sessions', 'teacher_name', 'varchar(255) DEFAULT NULL');

    // results — add unique key so duplicates are prevented
    await addUniqueKey(
      conn,
      'results',
      'student_session_term_subject',
      ['student_id', 'session', 'term', 'subject']
    );

    // attendance — unique on (student_id, date)
    await addUniqueKey(conn, 'attendance', 'student_date', ['student_id', 'date']);

    // assignment_submissions — unique on (assignment_id, student_id)
    await addUniqueKey(
      conn,
      'assignment_submissions',
      'assign_student',
      ['assignment_id', 'student_id']
    );

    // quiz_submissions — unique on (quiz_id, student_id)
    await addUniqueKey(
      conn,
      'quiz_submissions',
      'quiz_student',
      ['quiz_id', 'student_id']
    );

    // conversations — unique on (user1_id, user2_id)
    await addUniqueKey(conn, 'conversations', 'pair', ['user1_id', 'user2_id']);

    /* ===================== ENUMS ===================== */

    console.log('\n─── Fixing enum values ───────────────────');

    await modifyEnum(conn, 'users', 'role', [
      'student',
      'teacher',
      'admin',
      'parent',
    ]);

    console.log('\n✅ Upgrade complete\n');
  } catch (err) {
    console.error('\n❌ Upgrade failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

upgrade();