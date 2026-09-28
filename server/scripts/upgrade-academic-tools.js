require('dotenv').config();
const mysql = require('mysql2/promise');

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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id int(11) NOT NULL AUTO_INCREMENT,
        teacher_id int(11) NOT NULL,
        class_name varchar(50) NOT NULL,
        subject varchar(100) NOT NULL,
        question text NOT NULL,
        options text NOT NULL,
        answer tinyint(3) unsigned NOT NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY teacher_subject (teacher_id, class_name, subject),
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS lesson_plans (
        id int(11) NOT NULL AUTO_INCREMENT,
        teacher_id int(11) NOT NULL,
        class_name varchar(50) NOT NULL,
        subject varchar(100) NOT NULL,
        title varchar(255) NOT NULL,
        lesson_date date NOT NULL,
        objectives text NOT NULL,
        activities longtext,
        resources text,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY teacher_lesson_date (teacher_id, lesson_date),
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('Academic tools tables are ready.');
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('Academic tools migration failed:', error.message);
  process.exitCode = 1;
});