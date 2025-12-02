const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'collabstr_profiles.db');

console.log('=================================');
console.log('  Cleanup Invalid Profile IDs');
console.log('=================================');
console.log('');

const db = new Database(dbPath);

// Invalid patterns to clean up
const invalidPatterns = [
  /^-?\d+$/,          // Pure numbers or negative numbers (-10271, 123, etc.)
  /^[a-z]{1,2}$/i,    // Very short IDs (1-2 chars)
];

// Invalid paths
const invalidPaths = [
  'influencers',
  'brands',
  'login',
  'signup',
  'search',
  'how-it-works',
  'pricing',
  'about',
  'contact',
  'terms',
  'privacy',
  'faq'
];

console.log('🔍 Finding invalid profile IDs...');

// Get all unique profile IDs
const allProfiles = db.prepare('SELECT DISTINCT id FROM profiles').all();
console.log(`Total unique profiles: ${allProfiles.length}`);
console.log('');

let invalidIds = [];

allProfiles.forEach(profile => {
  const id = profile.id;

  // Check against patterns
  if (invalidPatterns.some(pattern => pattern.test(id))) {
    invalidIds.push(id);
    return;
  }

  // Check against invalid paths
  if (invalidPaths.includes(id.toLowerCase())) {
    invalidIds.push(id);
    return;
  }

  // Check if too short
  if (id.length < 3) {
    invalidIds.push(id);
    return;
  }
});

if (invalidIds.length === 0) {
  console.log('✓ No invalid profile IDs found!');
  db.close();
  process.exit(0);
}

console.log(`⚠️ Found ${invalidIds.length} invalid profile IDs:`);
invalidIds.forEach(id => {
  const count = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE id = ?').get(id);
  console.log(`  - "${id}" (${count.count} rows)`);
});
console.log('');

console.log('Deleting invalid profiles...');

const deleteStmt = db.prepare('DELETE FROM profiles WHERE id = ?');
const deleteMany = db.transaction((ids) => {
  let totalDeleted = 0;
  for (const id of ids) {
    const result = deleteStmt.run(id);
    totalDeleted += result.changes;
    console.log(`  ✓ Deleted "${id}" (${result.changes} rows)`);
  }
  return totalDeleted;
});

const totalDeleted = deleteMany(invalidIds);

console.log('');
console.log('=================================');
console.log(`✓ Deleted ${totalDeleted} total rows`);
console.log('=================================');

db.close();
