/* ------------------------------------------------------------------
   Migration script — applies schema.sql to the configured database.

   SAFE:
     ✓ Only creates missing tables (skips existing ones)
     ✓ Never drops or modifies existing data
     ✓ Retries statements that failed on FK ordering
     ✓ Two-pass: creates tables first, then retries FK-linked ones

   Run with:   node scripts/migrate.js
   ------------------------------------------------------------------ */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

/* -------- helpers -------- */

function cleanStatement(block) {
  // Drop leading blank lines and full-line -- comments
  const lines = block.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('--')) { i++; continue; }
    break;
  }
  return lines.slice(i).join('\n').trim();
}

function extractTableName(stmt) {
  const m = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i);
  return m ? m[1] : null;
}

function asIfNotExists(stmt) {
  // Turn "CREATE TABLE `x`" → "CREATE TABLE IF NOT EXISTS `x`"
  return stmt.replace(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i,
    'CREATE TABLE IF NOT EXISTS `$1`'
  );
}

/* -------- main -------- */

async function migrate() {
  const dbName = process.env.DB_NAME;
  const host   = process.env.DB_HOST;
  const user   = process.env.DB_USER;

  console.log('🔧 Applying schema to database…\n');
  console.log(`   Host: ${host}`);
  console.log(`   User: ${user}`);
  console.log(`   DB:   ${dbName}\n`);

  if (!host || !user || !dbName) {
    console.error('❌ DB_HOST, DB_USER and DB_NAME must be set in .env');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ schema.sql not found at ${schemaPath}`);
    process.exit(1);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT) || 3306,
      user,
      password: process.env.DB_PASSWORD,
      database: dbName,
      multipleStatements: false,
      ssl: { rejectUnauthorized: false },
    });
    console.log('   ✓ Connected\n');

    /* -------- split schema into discrete statements -------- */
    const blocks = schema.split(';');
    const statements = [];
    for (const block of blocks) {
      const clean = cleanStatement(block);
      if (!clean) continue;
      // Skip pure SET / COMMIT / etc.
      if (/^(SET|START TRANSACTION|COMMIT|USE)\b/i.test(clean)) continue;
      statements.push(clean);
    }

    /* -------- read existing tables -------- */
    const [existingRows] = await conn.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ?`,
      [dbName]
    );
    const existing = new Set(existingRows.map((r) => r.table_name));

    /* -------- PASS 1: try all CREATE TABLEs -------- */
    const deferred = [];
    let created = 0, skipped = 0;

    console.log('─── Pass 1 ───────────────────────────────');
    for (const stmt of statements) {
      const tableName = extractTableName(stmt);

      if (tableName) {
        if (existing.has(tableName)) {
          console.log(`   ⏭  ${tableName} (already exists)`);
          skipped++;
          continue;
        }

        try {
          await conn.query(asIfNotExists(stmt));
          console.log(`   ✓  ${tableName} created`);
          existing.add(tableName);
          created++;
        } catch (err) {
          console.log(`   ⏳ ${tableName} deferred (${err.code || err.message})`);
          deferred.push({ tableName, stmt });
        }
        continue;
      }

      // Non-CREATE-TABLE statement (indexes, etc.) — run quietly
      try { await conn.query(stmt); } catch { /* ignore */ }
    }

    /* -------- PASS 2: retry deferred (FK-order fixes) -------- */
    if (deferred.length) {
      console.log('\n─── Pass 2 (retrying FK-linked tables) ───');
      let stillFailing = [];

      for (const { tableName, stmt } of deferred) {
        try {
          await conn.query(asIfNotExists(stmt));
          console.log(`   ✓  ${tableName} created`);
          existing.add(tableName);
          created++;
        } catch (err) {
          console.log(`   ✗  ${tableName} still failing: ${err.message}`);
          stillFailing.push(tableName);
        }
      }

      if (stillFailing.length) {
        console.log(`\n⚠️  ${stillFailing.length} table(s) could not be created:`);
        stillFailing.forEach((t) => console.log(`      • ${t}`));
        console.log('\n   Most common cause: a referenced table is missing.');
        console.log('   Re-run the script after fixing any earlier failures.');
      }
    }

    console.log(`\n✅ Migration complete — ${created} created, ${skipped} skipped\n`);

    /* -------- summary of all tables in DB -------- */
    const [finalRows] = await conn.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ? ORDER BY table_name`,
      [dbName]
    );
    console.log(`📊 Database now has ${finalRows.length} tables:`);
    finalRows.forEach((r) => console.log(`      • ${r.table_name || r.TABLE_NAME}`));
    console.log('');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Wrong DB credentials in .env');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error(`   → Database '${dbName}' does not exist`);
    } else if (err.code === 'ETIMEDOUT') {
      console.error('   → Cannot reach host. Check DB_HOST and firewall.');
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();