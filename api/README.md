# Collabstr Scraper API

Node.js API server with SQLite database for storing scraped Collabstr profiles.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd api
npm install
```

### 1.5. Database Migration (If Upgrading from Old Version)

**⚠️ IMPORTANT**: If you already have an existing database with scraped profiles, you need to run the migration to add new columns:

```bash
npm run migrate
```

This will:
- ✅ Add new columns for profile details (name, location, bio, reviews, social platforms, status)
- ✅ Keep all your existing data intact
- ✅ Only run once (skips columns that already exist)

**Note**: New installations don't need this - the database is created with all columns automatically.

### 2. Start the Server

**Option 1: Quick Start (Windows)**
Double-click `START_SERVER.bat` in the api folder!

**Option 2: Command Line (Recommended)**
```bash
npm start
```
Automatically kills port 4000 first ✨

**Option 3: Development Mode**
```bash
npm run dev
```
Also kills port first, plus auto-reload ✨

**Option 4: Direct Start**
```bash
npm run start:direct
```
Without killing port (may fail if port in use)

**Note**: `npm start` and `npm run dev` now use `start.js` which automatically:
- ✅ Checks if port 4000 is in use
- ✅ Kills any processes using port 4000
- ✅ Starts the API server cleanly
- ✅ No more "EADDRINUSE" errors!

### 3. Server Running!

```
=================================
  Collabstr Scraper API Server
=================================
  🚀 Server running on port 4000
  📊 Database: /path/to/collabstr_profiles.db
  🌐 API: http://localhost:4000
=================================
```

## 📋 API Endpoints

### Health Check
```
GET /
```

Response:
```json
{
  "status": "ok",
  "message": "Collabstr Scraper API is running",
  "version": "1.0.0"
}
```

### Start Scraping Session
```
POST /api/session/start
```

Body:
```json
{
  "filters": {
    "platform": "instagram",
    "ph_id": "622942"
  }
}
```

Response:
```json
{
  "success": true,
  "sessionId": "session_1701234567890"
}
```

### End Scraping Session
```
POST /api/session/end
```

Body:
```json
{
  "sessionId": "session_1701234567890"
}
```

Response:
```json
{
  "success": true,
  "totalProfiles": 240,
  "totalPages": 10
}
```

### Save Profiles (Bulk Insert)
```
POST /api/profiles
```

Body:
```json
{
  "sessionId": "session_1701234567890",
  "profiles": [
    {
      "id": "username1",
      "page": 1,
      "scraped_at": "2025-12-02T10:30:15.123Z"
    },
    {
      "id": "username2",
      "page": 1,
      "scraped_at": "2025-12-02T10:30:15.123Z"
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "inserted": 2
}
```

### Get Statistics
```
GET /api/stats?sessionId=session_1701234567890
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalProfiles": 240,
    "uniqueProfiles": 235,
    "totalPages": 10,
    "profilesPerPage": [
      { "page": 1, "count": 24 },
      { "page": 2, "count": 24 },
      ...
    ]
  }
}
```

### Get All Profiles
```
GET /api/profiles?sessionId=session_1701234567890&limit=100&offset=0
```

Response:
```json
{
  "success": true,
  "count": 100,
  "profiles": [
    {
      "id": "username1",
      "page": 1,
      "scraped_at": "2025-12-02T10:30:15.123Z",
      "session_id": "session_1701234567890"
    },
    ...
  ]
}
```

### Export as CSV
```
GET /api/export/csv?sessionId=session_1701234567890
```

Downloads a CSV file with all profiles.

### Get All Sessions
```
GET /api/sessions
```

Response:
```json
{
  "success": true,
  "count": 5,
  "sessions": [
    {
      "session_id": "session_1701234567890",
      "started_at": "2025-12-02 10:30:00",
      "ended_at": "2025-12-02 10:45:00",
      "total_profiles": 240,
      "total_pages": 10,
      "filters": "{\"platform\":\"instagram\"}"
    },
    ...
  ]
}
```

### Clear Data
```
DELETE /api/profiles?sessionId=session_1701234567890
```

Response:
```json
{
  "success": true,
  "message": "Session deleted"
}
```

## 💾 Database Schema

### profiles table
```sql
CREATE TABLE profiles (
  id TEXT,
  page INTEGER,
  scraped_at DATETIME,
  session_id TEXT,
  PRIMARY KEY (id, page, session_id)
)
```

### sessions table
```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  started_at DATETIME,
  ended_at DATETIME,
  total_profiles INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  filters TEXT
)
```

## 🔧 Configuration

### Change Port

Edit `server.js`:
```javascript
const PORT = process.env.PORT || 4000;
```

Or use environment variable:
```bash
PORT=5000 npm start
```

### Database Location

The SQLite database is stored at:
```
api/collabstr_profiles.db
```

To change location, edit `server.js`:
```javascript
const dbPath = path.join(__dirname, 'your-custom-path.db');
```

## 📊 Accessing the Database

### Using SQLite Command Line

```bash
cd api
sqlite3 collabstr_profiles.db
```

```sql
-- Get all profiles
SELECT * FROM profiles LIMIT 10;

-- Get unique profiles
SELECT DISTINCT id FROM profiles;

-- Get profiles by session
SELECT * FROM profiles WHERE session_id = 'session_1701234567890';

-- Get stats
SELECT COUNT(*) as total FROM profiles;
SELECT COUNT(DISTINCT id) as unique FROM profiles;
SELECT page, COUNT(*) as count FROM profiles GROUP BY page;
```

### Using DB Browser for SQLite

1. Download [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Open `api/collabstr_profiles.db`
3. Browse data, run queries, export to CSV

## 🧪 Testing the API

### Using cURL

```bash
# Health check
curl http://localhost:4000/

# Start session
curl -X POST http://localhost:4000/api/session/start \
  -H "Content-Type: application/json" \
  -d '{"filters":{"platform":"instagram"}}'

# Save profiles
curl -X POST http://localhost:4000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "profiles": [
      {"id": "test1", "page": 1, "scraped_at": "2025-12-02T10:30:15.123Z"}
    ]
  }'

# Get stats
curl http://localhost:4000/api/stats

# Export CSV
curl http://localhost:4000/api/export/csv > profiles.csv
```

### Using Postman

Import this collection:
1. Open Postman
2. Import → Raw text
3. Paste the endpoints above
4. Test each endpoint

## 🔒 Security Notes

**IMPORTANT**: This API has **NO authentication** and is meant for local development only.

For production use:
- [ ] Add authentication (API keys, JWT, etc.)
- [ ] Use HTTPS
- [ ] Add rate limiting
- [ ] Validate all input
- [ ] Use environment variables for sensitive config
- [ ] Don't expose to public internet

## 🐛 Troubleshooting

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::4000
```

Solution:
- Change port in `server.js`
- Or kill process using port 4000:
  ```bash
  # Windows
  netstat -ano | findstr :4000
  taskkill /PID <PID> /F

  # Mac/Linux
  lsof -i :4000
  kill -9 <PID>
  ```

### Database Locked

```
Error: database is locked
```

Solution:
- Close any other programs accessing the database
- Restart the API server

### Module Not Found

```
Error: Cannot find module 'express'
```

Solution:
```bash
cd api
npm install
```

## 📈 Performance

- **SQLite**: Fast for < 1M records
- **Better-sqlite3**: Synchronous, faster than sqlite3
- **Bulk Inserts**: Use transactions for best performance
- **Indexing**: id and session_id are indexed via PRIMARY KEY

## 🚀 Deployment

### Local Network Access

To allow other devices on your network to access:

1. Edit `server.js`:
```javascript
app.listen(PORT, '0.0.0.0', () => {
  // ...
});
```

2. Find your local IP:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

3. Access from other devices:
```
http://192.168.1.XXX:4000
```

4. Update extension `background.js`:
```javascript
const API_URL = 'http://192.168.1.XXX:4000/api';
```

### Production Deployment

For production deployment, consider:
- **Heroku**: Easy Node.js deployment
- **DigitalOcean**: VPS with full control
- **AWS Lambda**: Serverless option
- **Railway**: Modern platform

Remember to:
- Use PostgreSQL or MySQL for production (SQLite is single-file)
- Add authentication
- Use HTTPS
- Set up monitoring
- Configure backups

## 📝 Logs

Server logs show:
- All API requests
- Database operations
- Errors and warnings

Example:
```
✓ Database initialized: /path/to/collabstr_profiles.db
✓ New session started: session_1701234567890
✓ Inserted 24 profiles (session: session_1701234567890)
✓ Session ended: session_1701234567890 - 240 profiles
```

## 🎯 Next Steps

1. Start the API server
2. Reload Chrome extension
3. Start scraping - data saves to SQLite!
4. Access database with any SQLite tool
5. Export data anytime with /api/export/csv

Happy scraping! 🎉
