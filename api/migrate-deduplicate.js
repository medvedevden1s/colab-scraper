const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'collabstr_profiles.db');
const backupPath = path.join(__dirname, `collabstr_profiles_backup_${Date.now()}.db`);

console.log('=================================');
console.log('  Database Migration & Deduplication');
console.log('=================================');
console.log('');

// Create backup
console.log('📦 Creating backup...');
fs.copyFileSync(dbPath, backupPath);
console.log(`✓ Backup created: ${backupPath}`);
console.log('');

const db = new Database(dbPath);

// Get current stats
console.log('📊 Current database stats:');
const oldTotal = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
const oldUnique = db.prepare('SELECT COUNT(DISTINCT id) as count FROM profiles').get();
console.log(`  Total rows: ${oldTotal.count}`);
console.log(`  Unique profiles: ${oldUnique.count}`);
console.log(`  Duplicates: ${oldTotal.count - oldUnique.count}`);
console.log('');

// Create new table with correct schema
console.log('🔨 Creating new table schema...');
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles_new (
    id TEXT PRIMARY KEY,
    name TEXT,
    location TEXT,
    bio TEXT,
    review_rating REAL,
    review_count INTEGER,

    -- Instagram
    instagram_link TEXT,
    instagram_followers TEXT,

    -- TikTok
    tiktok_link TEXT,
    tiktok_followers TEXT,

    -- YouTube
    youtube_link TEXT,
    youtube_followers TEXT,

    -- Twitter
    twitter_link TEXT,
    twitter_followers TEXT,

    -- Twitch
    twitch_link TEXT,
    twitch_followers TEXT,

    -- Amazon
    amazon_link TEXT,

    -- Metadata
    status TEXT DEFAULT 'id_only',
    first_scraped_at DATETIME,
    last_updated_at DATETIME,
    scraped_count INTEGER DEFAULT 1
  )
`);
console.log('✓ New table created');
console.log('');

// Migrate data with deduplication
console.log('🔄 Migrating and deduplicating data...');

const migrateStmt = db.prepare(`
  INSERT INTO profiles_new (
    id, name, location, bio, review_rating, review_count,
    instagram_link, instagram_followers,
    tiktok_link, tiktok_followers,
    youtube_link, youtube_followers,
    twitter_link, twitter_followers,
    twitch_link, twitch_followers,
    amazon_link,
    status, first_scraped_at, last_updated_at, scraped_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    location = excluded.location,
    bio = excluded.bio,
    review_rating = excluded.review_rating,
    review_count = excluded.review_count,
    instagram_link = excluded.instagram_link,
    instagram_followers = excluded.instagram_followers,
    tiktok_link = excluded.tiktok_link,
    tiktok_followers = excluded.tiktok_followers,
    youtube_link = excluded.youtube_link,
    youtube_followers = excluded.youtube_followers,
    twitter_link = excluded.twitter_link,
    twitter_followers = excluded.twitter_followers,
    twitch_link = excluded.twitch_link,
    twitch_followers = excluded.twitch_followers,
    amazon_link = excluded.amazon_link,
    status = excluded.status,
    last_updated_at = excluded.last_updated_at,
    scraped_count = scraped_count + 1
`);

// Get all profiles ordered by most recent first
const allProfiles = db.prepare(`
  SELECT *
  FROM profiles
  ORDER BY
    CASE
      WHEN profile_scraped_at IS NOT NULL THEN profile_scraped_at
      WHEN scraped_at IS NOT NULL THEN scraped_at
      ELSE '1970-01-01'
    END DESC
`).all();

console.log(`Processing ${allProfiles.length} rows...`);

let migrated = 0;
let skipped = 0;

const migrateTransaction = db.transaction(() => {
  for (const profile of allProfiles) {
    try {
      // Parse social_platforms JSON
      let socialPlatforms = [];
      if (profile.social_platforms) {
        try {
          socialPlatforms = JSON.parse(profile.social_platforms);
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Extract platform-specific data
      const instagram = socialPlatforms.find(p => p.platform === 'instagram') || {};
      const tiktok = socialPlatforms.find(p => p.platform === 'tiktok') || {};
      const youtube = socialPlatforms.find(p => p.platform === 'youtube') || {};
      const twitter = socialPlatforms.find(p => p.platform === 'twitter') || {};
      const twitch = socialPlatforms.find(p => p.platform === 'twitch') || {};
      const amazon = socialPlatforms.find(p => p.platform === 'amazon') || {};

      const lastUpdated = profile.profile_scraped_at || profile.scraped_at || new Date().toISOString();

      migrateStmt.run(
        profile.id,
        profile.name,
        profile.location,
        profile.bio,
        profile.review_rating,
        profile.review_count,
        instagram.link || null,
        instagram.followers || null,
        tiktok.link || null,
        tiktok.followers || null,
        youtube.link || null,
        youtube.followers || null,
        twitter.link || null,
        twitter.followers || null,
        twitch.link || null,
        twitch.followers || null,
        amazon.link || null,
        profile.status || 'id_only',
        profile.scraped_at || lastUpdated,
        lastUpdated,
        1
      );

      migrated++;
      if (migrated % 1000 === 0) {
        console.log(`  Processed ${migrated}/${allProfiles.length}...`);
      }
    } catch (error) {
      console.error(`Error migrating ${profile.id}:`, error.message);
      skipped++;
    }
  }
});

migrateTransaction();

console.log(`✓ Migration complete`);
console.log(`  Migrated: ${migrated}`);
console.log(`  Skipped (errors): ${skipped}`);
console.log('');

// Get new stats
const newTotal = db.prepare('SELECT COUNT(*) as count FROM profiles_new').get();
const withData = db.prepare('SELECT COUNT(*) as count FROM profiles_new WHERE status = "scraped"').get();
const idOnly = db.prepare('SELECT COUNT(*) as count FROM profiles_new WHERE status = "id_only" OR status IS NULL').get();
const invalid = db.prepare('SELECT COUNT(*) as count FROM profiles_new WHERE status = "invalid"').get();

console.log('📊 New database stats:');
console.log(`  Total unique profiles: ${newTotal.count}`);
console.log(`  Fully scraped: ${withData.count}`);
console.log(`  ID only: ${idOnly.count}`);
console.log(`  Invalid: ${invalid.count}`);
console.log('');

// Drop old table and rename new one
console.log('🔄 Replacing old table...');
db.exec('DROP TABLE profiles');
db.exec('ALTER TABLE profiles_new RENAME TO profiles');
db.exec('DROP TABLE IF EXISTS sessions'); // Sessions table is no longer needed
console.log('✓ Old table replaced');
console.log('');

console.log('✅ Migration completed successfully!');
console.log('');
console.log('Summary:');
console.log(`  • Deduplicated: ${oldTotal.count} → ${newTotal.count} rows`);
console.log(`  • Removed ${oldTotal.count - newTotal.count} duplicate entries`);
console.log(`  • Extracted social platforms into separate columns`);
console.log(`  • Backup saved at: ${path.basename(backupPath)}`);
console.log('');

db.close();
