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

async function columnExists(conn, table, column) {
  const [r] = await conn.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME, table, column]
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
    /* ---------- 1. Extend question_bank ---------- */
    console.log('─── question_bank ────────────────────');

    if (!(await columnExists(conn, 'question_bank', 'source_type'))) {
      await conn.query(
        `ALTER TABLE question_bank
         ADD COLUMN source_type enum('manual','quiz','assignment')
           NOT NULL DEFAULT 'manual' AFTER answer`
      );
      console.log('   ✓  source_type added');
    } else {
      console.log('   ⏭  source_type (exists)');
    }

    if (!(await columnExists(conn, 'question_bank', 'source_id'))) {
      await conn.query(
        `ALTER TABLE question_bank ADD COLUMN source_id int(11) DEFAULT NULL AFTER source_type`
      );
      console.log('   ✓  source_id added');
    } else {
      console.log('   ⏭  source_id (exists)');
    }

    if (!(await columnExists(conn, 'question_bank', 'source_name'))) {
      await conn.query(
        `ALTER TABLE question_bank ADD COLUMN source_name varchar(255) DEFAULT NULL AFTER source_id`
      );
      console.log('   ✓  source_name added');
    } else {
      console.log('   ⏭  source_name (exists)');
    }

    if (!(await columnExists(conn, 'question_bank', 'usage_count'))) {
      await conn.query(
        `ALTER TABLE question_bank ADD COLUMN usage_count int(11) NOT NULL DEFAULT 0 AFTER source_name`
      );
      console.log('   ✓  usage_count added');
    } else {
      console.log('   ⏭  usage_count (exists)');
    }

    if (!(await columnExists(conn, 'question_bank', 'last_used_at'))) {
      await conn.query(
        `ALTER TABLE question_bank ADD COLUMN last_used_at datetime DEFAULT NULL AFTER usage_count`
      );
      console.log('   ✓  last_used_at added');
    } else {
      console.log('   ⏭  last_used_at (exists)');
    }

    /* ---------- 2. assignment_templates ---------- */
    console.log('\n─── assignment_templates ─────────────');

    if (await tableExists(conn, 'assignment_templates')) {
      console.log('   ⏭  assignment_templates (exists)');
    } else {
      await conn.query(`
        CREATE TABLE \`assignment_templates\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`teacher_id\` int(11) NOT NULL,
          \`title\` varchar(255) NOT NULL,
          \`subject\` varchar(100) NOT NULL,
          \`class_name\` varchar(50) NOT NULL,
          \`description\` text,
          \`total_marks\` int(11) DEFAULT 10,
          \`source_id\` int(11) DEFAULT NULL,
          \`usage_count\` int(11) NOT NULL DEFAULT 0,
          \`last_used_at\` datetime DEFAULT NULL,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`teacher_subject_class\` (\`teacher_id\`,\`subject\`,\`class_name\`),
          FOREIGN KEY (\`teacher_id\`) REFERENCES \`teachers\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('   ✓  assignment_templates created');
    }

    /* ---------- 3. Backfill from existing quizzes ---------- */
    console.log('\n─── Backfilling existing quiz questions ─');

    const [existingBank] = await conn.query(
      `SELECT COUNT(*) AS n FROM question_bank WHERE source_type = 'quiz'`
    );
    if (Number(existingBank[0].n) > 0) {
      console.log('   ⏭  Already backfilled (found ' + existingBank[0].n + ' quiz-sourced rows)');
    } else {
      const [quizzes] = await conn.query(
        `SELECT id, title, class_name, subject, teacher_id, questions FROM quizzes`
      );
      let total = 0;
      for (const q of quizzes) {
        let questions = [];
        try { questions = JSON.parse(q.questions || '[]'); } catch { continue; }
        for (const item of questions) {
          if (!item.question) continue;
          await conn.query(
            `INSERT INTO question_bank
              (teacher_id, class_name, subject, question, options, answer,
               source_type, source_id, source_name)
             VALUES (?, ?, ?, ?, ?, ?, 'quiz', ?, ?)`,
            [
              q.teacher_id, q.class_name, q.subject,
              String(item.question).trim(),
              JSON.stringify(item.options || []),
              Number(item.answer) || 0,
              q.id, q.title,
            ]
          );
          total++;
        }
      }
      console.log(`   ✓  Backfilled ${total} question(s) from ${quizzes.length} quiz(zes)`);
    }

    /* ---------- 4. Backfill from existing assignments ---------- */
    console.log('\n─── Backfilling existing assignments ─');

    const [existingTpl] = await conn.query(
      'SELECT COUNT(*) AS n FROM assignment_templates'
    );
    if (Number(existingTpl[0].n) > 0) {
      console.log('   ⏭  Already backfilled (found ' + existingTpl[0].n + ' templates)');
    } else {
      const [assignments] = await conn.query(
        `SELECT id, teacher_id, title, subject, class_name, description, total_marks FROM assignments`
      );
      for (const a of assignments) {
        await conn.query(
          `INSERT INTO assignment_templates
            (teacher_id, title, subject, class_name, description, total_marks, source_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [a.teacher_id, a.title, a.subject, a.class_name, a.description || '', a.total_marks || 10, a.id]
        );
      }
      console.log(`   ✓  Backfilled ${assignments.length} template(s)`);
    }

    console.log('\n✅ Batch 8 schema ready\n');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error('\n❌ Failed:', e.message);
  process.exitCode = 1;
});