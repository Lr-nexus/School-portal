/* ------------------------------------------------------------------
   Bulk password reset for all active users.
   Run:   node scripts/set-passwords.js

   Changes:
     teachers  →  Teacher@123
     students  →  Student@123
     parents   →  Parent@123
     admins    →  (untouched)
   ------------------------------------------------------------------ */

require('dotenv').config();
const mysql = require('mysql2/promise');

const TARGETS = [
  { role: 'teacher', password: 'Teacher@123' },
  { role: 'student', password: 'Student@123' },
  { role: 'parent',  password: 'Parent@123'  },
];

async function run() {
  const dbName = process.env.DB_NAME;
  const host   = process.env.DB_HOST;
  const user   = process.env.DB_USER;

  console.log('\n🔐 Bulk password reset\n');
  console.log(`   Host: ${host}`);
  console.log(`   DB:   ${dbName}\n`);

  if (!host || !user || !dbName) {
    console.error('❌ DB_HOST, DB_USER and DB_NAME must be set in .env');
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT) || 3306,
      user,
      password: process.env.DB_PASSWORD,
      database: dbName,
      ssl: { rejectUnauthorized: false },
    });
    console.log('   ✓ Connected\n');

    /* ---------- Show current state ---------- */
    const [before] = await conn.query(
      `SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role`
    );
    console.log('─── Before ─────────────────────────────');
    before.forEach((r) =>
      console.log(`   ${r.role.padEnd(10)} ${String(r.count).padStart(4)}`)
    );

    /* ---------- Perform updates ---------- */
    console.log('\n─── Applying new passwords ─────────────');
    const summary = [];

    for (const t of TARGETS) {
      const [result] = await conn.query(
        `UPDATE users SET password = ? WHERE role = ?`,
        [t.password, t.role]
      );
      console.log(`   ✓ ${result.affectedRows} ${t.role}${result.affectedRows === 1 ? '' : 's'}  →  ${t.password}`);
      summary.push({ role: t.role, count: result.affectedRows });
    }

    /* ---------- Verify ---------- */
    const [after] = await conn.query(
      `SELECT role, password, COUNT(*) AS count
       FROM users
       GROUP BY role, password
       ORDER BY role`
    );

    console.log('\n─── After ──────────────────────────────');
    after.forEach((r) =>
      console.log(`   ${r.role.padEnd(10)}  ${r.password.padEnd(14)}  ${String(r.count).padStart(4)} user${r.count === 1 ? '' : 's'}`)
    );

    /* ---------- Sanity check ---------- */
    console.log('\n─── Sanity check ───────────────────────');
    const expected = {
      teacher: 'Teacher@123',
      student: 'Student@123',
      parent:  'Parent@123',
    };
    let ok = true;
    for (const [role, pwd] of Object.entries(expected)) {
      const bad = after.find((r) => r.role === role && r.password !== pwd);
      if (bad) {
        console.log(`   ✗ ${role}: found ${bad.count} row(s) with wrong password`);
        ok = false;
      }
    }
    if (ok) console.log('   ✓ All target roles use the new passwords');

    console.log('\n✅ Done\n');
    console.log('   Demo logins:');
    console.log('     Teacher   teacher@school.com    Teacher@123');
    console.log('     Student   ada@school.com        Student@123');
    console.log('     Parent    parent@school.com     Parent@123');
    console.log('     Admin     admin@school.com      admin123     (unchanged)\n');
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Wrong DB credentials in .env');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('   → Cannot reach host. Check DB_HOST and firewall.');
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();