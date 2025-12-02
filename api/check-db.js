const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'collabstr_profiles.db');
const db = new Database(dbPath);

console.log('\n=== First 10 records in database ===');
const first10 = db.prepare('SELECT id, page, session_id, status FROM profiles LIMIT 10').all();
first10.forEach((row, index) => {
  console.log(`${index + 1}. id="${row.id}" page=${row.page} session=${row.session_id} status=${row.status || 'NULL'}`);
});

console.log('\n=== Searching for "-10271" ===');
const search = db.prepare('SELECT * FROM profiles WHERE id = ?').all('-10271');
console.log(`Found ${search.length} records with id="-10271"`);

console.log('\n=== Unscraped profiles (status = id_only or NULL) - IN INSERTION ORDER ===');
const unscraped = db.prepare(`
  SELECT id, MIN(session_id) as session_id
  FROM profiles
  WHERE (status = 'id_only' OR status IS NULL)
    AND status != 'scraped'
    AND status != 'invalid'
    AND status != 'failed'
  GROUP BY id
  ORDER BY MIN(ROWID)
  LIMIT 10
`).all();
console.log(`Found ${unscraped.length} unscraped profiles:`);
unscraped.forEach((row, index) => {
  console.log(`${index + 1}. id="${row.id}" session=${row.session_id}`);
});

console.log('\n=== Total counts by status ===');
const counts = db.prepare('SELECT status, COUNT(*) as count FROM profiles GROUP BY status').all();
counts.forEach(row => {
  console.log(`  ${row.status || 'NULL'}: ${row.count}`);
});

db.close();
