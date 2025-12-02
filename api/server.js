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

// Create profiles table
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT,
    page INTEGER,
    scraped_at DATETIME,
    session_id TEXT,
    name TEXT,
    location TEXT,
    bio TEXT,
    review_rating REAL,
    review_count INTEGER,
    social_platforms TEXT,
    status TEXT DEFAULT 'id_only',
    profile_scraped_at DATETIME,
    PRIMARY KEY (id, page, session_id)
  )
`);

// Create sessions table to track scraping sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    started_at DATETIME,
    ended_at DATETIME,
    total_profiles INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    filters TEXT
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

// Start a new scraping session
app.post('/api/session/start', (req, res) => {
  try {
    const sessionId = `session_${Date.now()}`;
    const { filters } = req.body;

    const stmt = db.prepare(`
      INSERT INTO sessions (session_id, started_at, filters)
      VALUES (?, datetime('now'), ?)
    `);

    stmt.run(sessionId, JSON.stringify(filters || {}));

    console.log('✓ New session started:', sessionId);

    res.json({
      success: true,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// End a scraping session
app.post('/api/session/end', (req, res) => {
  try {
    const { sessionId } = req.body;

    // Get total profiles for this session
    const count = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE session_id = ?').get(sessionId);
    const maxPage = db.prepare('SELECT MAX(page) as max FROM profiles WHERE session_id = ?').get(sessionId);

    // Update session
    const stmt = db.prepare(`
      UPDATE sessions
      SET ended_at = datetime('now'),
          total_profiles = ?,
          total_pages = ?
      WHERE session_id = ?
    `);

    stmt.run(count.count, maxPage.max || 0, sessionId);

    console.log('✓ Session ended:', sessionId, '-', count.count, 'profiles');

    res.json({
      success: true,
      totalProfiles: count.count,
      totalPages: maxPage.max || 0
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save profiles (bulk insert)
app.post('/api/profiles', (req, res) => {
  try {
    const { profiles, sessionId } = req.body;

    if (!profiles || !Array.isArray(profiles)) {
      return res.status(400).json({
        success: false,
        error: 'Profiles array is required'
      });
    }

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO profiles (id, page, scraped_at, session_id)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = db.transaction((profilesList) => {
      for (const profile of profilesList) {
        stmt.run(
          profile.id,
          profile.page,
          profile.scraped_at || new Date().toISOString(),
          sessionId || 'default'
        );
      }
    });

    insertMany(profiles);

    console.log(`✓ Inserted ${profiles.length} profiles (session: ${sessionId || 'default'})`);

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
    const { sessionId } = req.query;

    let totalProfiles, uniqueProfiles, totalPages, profilesPerPage;

    if (sessionId) {
      // Stats for specific session
      totalProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE session_id = ?').get(sessionId);
      uniqueProfiles = db.prepare('SELECT COUNT(DISTINCT id) as count FROM profiles WHERE session_id = ?').get(sessionId);
      totalPages = db.prepare('SELECT MAX(page) as max FROM profiles WHERE session_id = ?').get(sessionId);
      profilesPerPage = db.prepare(`
        SELECT page, COUNT(*) as count
        FROM profiles
        WHERE session_id = ?
        GROUP BY page
        ORDER BY page
      `).all(sessionId);
    } else {
      // Stats for all data
      totalProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles').get();
      uniqueProfiles = db.prepare('SELECT COUNT(DISTINCT id) as count FROM profiles').get();
      totalPages = db.prepare('SELECT MAX(page) as max FROM profiles').get();
      profilesPerPage = db.prepare(`
        SELECT page, COUNT(*) as count
        FROM profiles
        GROUP BY page
        ORDER BY page
      `).all();
    }

    res.json({
      success: true,
      stats: {
        totalProfiles: totalProfiles.count,
        uniqueProfiles: uniqueProfiles.count,
        totalPages: totalPages.max || 0,
        profilesPerPage: profilesPerPage
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
    const { sessionId, page, limit = 1000, offset = 0 } = req.query;

    let query = 'SELECT * FROM profiles';
    let params = [];

    if (sessionId) {
      query += ' WHERE session_id = ?';
      params.push(sessionId);
    }

    if (page) {
      query += sessionId ? ' AND page = ?' : ' WHERE page = ?';
      params.push(page);
    }

    query += ' ORDER BY page, id LIMIT ? OFFSET ?';
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
    const { sessionId } = req.query;

    let query = 'SELECT id, page, scraped_at, session_id FROM profiles ORDER BY page, id';
    let params = [];

    if (sessionId) {
      query = 'SELECT id, page, scraped_at, session_id FROM profiles WHERE session_id = ? ORDER BY page, id';
      params.push(sessionId);
    }

    const profiles = db.prepare(query).all(...params);

    // Create CSV
    let csv = 'id,page,scraped_at,session_id\n';
    profiles.forEach(profile => {
      csv += `${profile.id},${profile.page},${profile.scraped_at},${profile.session_id}\n`;
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

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT * FROM sessions
      ORDER BY started_at DESC
    `).all();

    res.json({
      success: true,
      count: sessions.length,
      sessions: sessions
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear all data
app.delete('/api/profiles', (req, res) => {
  try {
    const { sessionId } = req.query;

    if (sessionId) {
      db.prepare('DELETE FROM profiles WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
      console.log('✓ Deleted session:', sessionId);
    } else {
      db.prepare('DELETE FROM profiles').run();
      db.prepare('DELETE FROM sessions').run();
      console.log('✓ Deleted all data');
    }

    res.json({
      success: true,
      message: sessionId ? 'Session deleted' : 'All data deleted'
    });
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
    const { limit = 100, sessionId } = req.query;

    let query = `
      SELECT id, MIN(session_id) as session_id
      FROM profiles
      WHERE (status = 'id_only' OR status IS NULL)
        AND status != 'scraped'
        AND status != 'invalid'
        AND status != 'failed'
    `;
    let params = [];

    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    query += ' GROUP BY id ORDER BY MIN(ROWID) LIMIT ?';
    params.push(parseInt(limit));

    const profiles = db.prepare(query).all(...params);

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
      status,
      sessionId
    } = req.body;

    const stmt = db.prepare(`
      UPDATE profiles
      SET name = ?,
          location = ?,
          bio = ?,
          review_rating = ?,
          review_count = ?,
          social_platforms = ?,
          status = ?,
          profile_scraped_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(
      name,
      location,
      bio,
      review_rating,
      review_count,
      JSON.stringify(social_platforms || []),
      status || 'scraped',
      id
    );

    console.log(`✓ Updated ${result.changes} row(s) for profile: ${id}`);

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
    const { sessionId } = req.query;

    let query = 'SELECT status, COUNT(*) as count FROM profiles';
    let params = [];

    if (sessionId) {
      query += ' WHERE session_id = ?';
      params.push(sessionId);
    }

    query += ' GROUP BY status';

    const statusCounts = db.prepare(query).all(...params);

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
  console.log('  GET  /                      - Health check');
  console.log('  POST /api/session/start     - Start scraping session');
  console.log('  POST /api/session/end       - End scraping session');
  console.log('  POST /api/profiles          - Save profiles');
  console.log('  GET  /api/profiles          - Get all profiles');
  console.log('  GET  /api/stats             - Get statistics');
  console.log('  GET  /api/export/csv        - Export as CSV');
  console.log('  GET  /api/sessions          - Get all sessions');
  console.log('  DELETE /api/profiles        - Clear data');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nClosing database connection...');
  db.close();
  process.exit(0);
});
