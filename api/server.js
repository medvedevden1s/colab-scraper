const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors()); // Allow Chrome extension to make requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'collabstr_profiles.db');
const db = new Database(dbPath);

// Create profiles table with current schema
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT,
    location TEXT,
    bio TEXT,
    review_rating REAL,
    review_count INTEGER,

    -- Instagram
    instagram_link TEXT,
    instagram_followers INTEGER,

    -- TikTok
    tiktok_link TEXT,
    tiktok_followers INTEGER,

    -- YouTube
    youtube_link TEXT,
    youtube_followers INTEGER,

    -- Twitter
    twitter_link TEXT,
    twitter_followers INTEGER,

    -- Twitch
    twitch_link TEXT,
    twitch_followers INTEGER,

    -- Amazon
    amazon_link TEXT,

    -- Metadata
    status TEXT DEFAULT 'id_only',
    first_scraped_at DATETIME,
    last_updated_at DATETIME,
    scraped_count INTEGER DEFAULT 1
  )
`);

console.log('✓ Database initialized:', dbPath);

// API Routes

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Collabstr Scraper API is running',
    version: '1.0.0'
  });
});

// Save profile IDs (bulk insert for initial scraping)
app.post('/api/profiles', (req, res) => {
  try {
    const { profiles } = req.body;

    if (!profiles || !Array.isArray(profiles)) {
      return res.status(400).json({
        success: false,
        error: 'Profiles array is required'
      });
    }

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO profiles (id, status, first_scraped_at)
      VALUES (?, 'id_only', datetime('now'))
    `);

    const insertMany = db.transaction((profilesList) => {
      for (const profile of profilesList) {
        stmt.run(profile.id);
      }
    });

    insertMany(profiles);

    console.log(`✓ Inserted ${profiles.length} profile IDs`);

    res.json({
      success: true,
      inserted: profiles.length
    });
  } catch (error) {
    console.error('Error inserting profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const totalProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
    const scrapedProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE status = ?').get('scraped');
    const idOnlyProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE status = ? OR status IS NULL').get('id_only');

    // Platform stats
    const withInstagram = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE instagram_link IS NOT NULL').get();
    const withTiktok = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE tiktok_link IS NOT NULL').get();
    const withYoutube = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE youtube_link IS NOT NULL').get();

    res.json({
      success: true,
      stats: {
        totalProfiles: totalProfiles.count,
        scrapedProfiles: scrapedProfiles.count,
        idOnlyProfiles: idOnlyProfiles.count,
        platforms: {
          instagram: withInstagram.count,
          tiktok: withTiktok.count,
          youtube: withYoutube.count
        }
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all profiles
app.get('/api/profiles', (req, res) => {
  try {
    const { status, limit = 1000, offset = 0 } = req.query;

    let query = 'SELECT * FROM profiles';
    let params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY id LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const profiles = db.prepare(query).all(...params);

    res.json({
      success: true,
      count: profiles.length,
      profiles: profiles
    });
  } catch (error) {
    console.error('Error getting profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export profiles as CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const profiles = db.prepare(`
      SELECT
        id, name, location, bio,
        instagram_link, instagram_followers,
        tiktok_link, tiktok_followers,
        youtube_link, youtube_followers,
        twitter_link, twitter_followers,
        review_rating, review_count,
        status, first_scraped_at, last_updated_at
      FROM profiles
      ORDER BY id
    `).all();

    // Create CSV header
    let csv = 'id,name,location,bio,instagram_link,instagram_followers,tiktok_link,tiktok_followers,youtube_link,youtube_followers,twitter_link,twitter_followers,review_rating,review_count,status,first_scraped_at,last_updated_at\n';

    // Add rows
    profiles.forEach(profile => {
      const row = [
        profile.id || '',
        (profile.name || '').replace(/,/g, ';'),
        (profile.location || '').replace(/,/g, ';'),
        (profile.bio || '').replace(/,/g, ';').replace(/\n/g, ' '),
        profile.instagram_link || '',
        profile.instagram_followers || '',
        profile.tiktok_link || '',
        profile.tiktok_followers || '',
        profile.youtube_link || '',
        profile.youtube_followers || '',
        profile.twitter_link || '',
        profile.twitter_followers || '',
        profile.review_rating || '',
        profile.review_count || '',
        profile.status || '',
        profile.first_scraped_at || '',
        profile.last_updated_at || ''
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="collabstr-profiles-${Date.now()}.csv"`);
    res.send(csv);

    console.log(`✓ Exported ${profiles.length} profiles as CSV`);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear all data (or specific profiles by status)
app.delete('/api/profiles', (req, res) => {
  try {
    const { status } = req.query;

    if (status) {
      const result = db.prepare('DELETE FROM profiles WHERE status = ?').run(status);
      console.log(`✓ Deleted ${result.changes} profiles with status: ${status}`);
      res.json({
        success: true,
        message: `Deleted ${result.changes} profiles with status: ${status}`,
        deleted: result.changes
      });
    } else {
      const result = db.prepare('DELETE FROM profiles').run();
      console.log(`✓ Deleted all ${result.changes} profiles`);
      res.json({
        success: true,
        message: `Deleted all ${result.changes} profiles`,
        deleted: result.changes
      });
    }
  } catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get profiles that need detail scraping
app.get('/api/profiles/unscraped', (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const query = `
      SELECT id
      FROM profiles
      WHERE (status = 'id_only' OR status IS NULL)
        AND status != 'scraped'
        AND status != 'invalid'
        AND status != 'failed'
      ORDER BY first_scraped_at ASC
      LIMIT ?
    `;

    const profiles = db.prepare(query).all(parseInt(limit));

    res.json({
      success: true,
      count: profiles.length,
      profiles: profiles
    });
  } catch (error) {
    console.error('Error getting unscraped profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update profile with detailed information
app.put('/api/profiles/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      location,
      bio,
      review_rating,
      review_count,
      social_platforms,
      status
    } = req.body;

    // Extract platform-specific data from social_platforms array
    const platforms = social_platforms || [];
    const instagram = platforms.find(p => p.platform === 'instagram') || {};
    const tiktok = platforms.find(p => p.platform === 'tiktok') || {};
    const youtube = platforms.find(p => p.platform === 'youtube') || {};
    const twitter = platforms.find(p => p.platform === 'twitter') || {};
    const twitch = platforms.find(p => p.platform === 'twitch') || {};
    const amazon = platforms.find(p => p.platform === 'amazon') || {};

    const stmt = db.prepare(`
      INSERT INTO profiles (
        id, name, location, bio, review_rating, review_count,
        instagram_link, instagram_followers,
        tiktok_link, tiktok_followers,
        youtube_link, youtube_followers,
        twitter_link, twitter_followers,
        twitch_link, twitch_followers,
        amazon_link,
        status, last_updated_at, first_scraped_at, scraped_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1)
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
        last_updated_at = datetime('now'),
        scraped_count = scraped_count + 1
    `);

    const result = stmt.run(
      id,
      name,
      location,
      bio,
      review_rating,
      review_count,
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
      status || 'scraped'
    );

    console.log(`✓ Updated profile: ${id} (${name})`);

    res.json({
      success: true,
      changes: result.changes
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get profile scraping progress
app.get('/api/profiles/progress', (req, res) => {
  try {
    const statusCounts = db.prepare('SELECT status, COUNT(*) as count FROM profiles GROUP BY status').all();

    // Calculate totals
    let total = 0;
    let scraped = 0;
    let idOnly = 0;
    let failed = 0;
    let invalid = 0;

    statusCounts.forEach(row => {
      total += row.count;
      if (row.status === 'scraped') scraped = row.count;
      else if (row.status === 'id_only' || !row.status) idOnly = row.count;
      else if (row.status === 'failed') failed = row.count;
      else if (row.status === 'invalid') invalid = row.count;
    });

    res.json({
      success: true,
      progress: {
        total,
        scraped,
        idOnly,
        failed,
        invalid,
        percentage: total > 0 ? Math.round((scraped / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('=================================');
  console.log('  Collabstr Scraper API Server  ');
  console.log('=================================');
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  📊 Database: ${dbPath}`);
  console.log(`  🌐 API: http://localhost:${PORT}`);
  console.log('=================================');
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET    /                          - Health check');
  console.log('  POST   /api/profiles              - Save profile IDs');
  console.log('  GET    /api/profiles              - Get all profiles');
  console.log('  GET    /api/profiles/unscraped    - Get unscraped profiles');
  console.log('  GET    /api/profiles/progress     - Get scraping progress');
  console.log('  PUT    /api/profiles/:id          - Update profile details');
  console.log('  DELETE /api/profiles              - Clear data');
  console.log('  GET    /api/stats                 - Get statistics');
  console.log('  GET    /api/export/csv            - Export as CSV');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nClosing database connection...');
  db.close();
  process.exit(0);
});
