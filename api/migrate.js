const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'collabstr_profiles.db');

console.log('=================================');
console.log('  Database Migration Script');
console.log('=================================');
console.log('Database:', dbPath);
console.log('');

const db = new Database(dbPath);

// Check if columns exist
function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some(col => col.name === columnName);
}

console.log('🔍 Checking for missing columns...');

const columnsToAdd = [
  { name: 'name', type: 'TEXT' },
  { name: 'location', type: 'TEXT' },
  { name: 'bio', type: 'TEXT' },
  { name: 'review_rating', type: 'REAL' },
  { name: 'review_count', type: 'INTEGER' },
  { name: 'social_platforms', type: 'TEXT' },
  { name: 'status', type: 'TEXT', default: "'id_only'" },
  { name: 'profile_scraped_at', type: 'DATETIME' }
];

let addedColumns = 0;
let skippedColumns = 0;

columnsToAdd.forEach(column => {
  if (columnExists('profiles', column.name)) {
    console.log(`  ✓ Column '${column.name}' already exists - skipping`);
    skippedColumns++;
  } else {
    try {
      const defaultClause = column.default ? ` DEFAULT ${column.default}` : '';
      const sql = `ALTER TABLE profiles ADD COLUMN ${column.name} ${column.type}${defaultClause}`;
      console.log(`  + Adding column '${column.name}'...`);
      db.prepare(sql).run();
      console.log(`  ✓ Added '${column.name}' successfully`);
      addedColumns++;
    } catch (error) {
      console.error(`  ✗ Failed to add '${column.name}':`, error.message);
    }
  }
});

console.log('');
console.log('=================================');
console.log('  Migration Complete');
console.log('=================================');
console.log(`  Added columns: ${addedColumns}`);
console.log(`  Skipped (already exist): ${skippedColumns}`);
console.log('');

// Show final table structure
console.log('Final table structure:');
const finalColumns = db.prepare('PRAGMA table_info(profiles)').all();
finalColumns.forEach(col => {
  console.log(`  - ${col.name} (${col.type})`);
});

db.close();
console.log('');
console.log('✓ Done! You can now start the server.');
