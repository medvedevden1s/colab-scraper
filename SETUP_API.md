# Complete Setup Guide - Chrome Extension + API + SQLite

This guide shows you how to set up the complete system with the Chrome extension saving data to a Node.js API with a real SQLite database.

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                         │
│  (Scrapes Collabstr profiles from browser)                 │
│                                                             │
│  - content.js: Extracts profile IDs                        │
│  - background.js: Sends data to API                        │
│  - popup.js: UI controls                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP POST/GET
                       │ http://localhost:4000/api
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Node.js API Server                       │
│  (Express server handling data)                            │
│                                                             │
│  - Receives scraped profiles                               │
│  - Validates and processes data                            │
│  - Manages scraping sessions                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL queries
                       │ better-sqlite3
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Database                          │
│  (Real database file: collabstr_profiles.db)               │
│                                                             │
│  - profiles table: id, page, scraped_at, session_id        │
│  - sessions table: metadata about scraping runs            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Step 1: Install API Server

### Navigate to API folder:
```bash
cd api
```

### Install dependencies:
```bash
npm install
```

This installs:
- **express**: Web server framework
- **cors**: Allow Chrome extension requests
- **better-sqlite3**: Fast native SQLite
- **body-parser**: Parse JSON requests

---

## 🚀 Step 2: Start API Server

### Option A: Production Mode
```bash
npm start
```

### Option B: Development Mode (auto-reload)
```bash
npm run dev
```

You should see:
```
=================================
  Collabstr Scraper API Server
=================================
  🚀 Server running on port 4000
  📊 Database: /path/to/collabstr_profiles.db
  🌐 API: http://localhost:4000
=================================
```

**Keep this terminal open!** The server must be running for the extension to save data.

---

## 🔧 Step 3: Setup Chrome Extension

### Generate Icons (if not done):
Open `generate-icons.html` in browser → Download all 3 icons

### Load Extension in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `Pluign` folder (parent folder, not api folder)
5. Extension loads ✓

**No more npm install needed for extension!** We removed sql.js completely.

---

## ✅ Step 4: Verify API Connection

### Check Extension Background Console:
1. Go to `chrome://extensions/`
2. Find "Collabstr Profile Scraper"
3. Click **"service worker"**
4. Look for this message:
   ```
   [Background] ✓ API server connected: Collabstr Scraper API is running
   ```

If you see this, everything is connected! ✅

If you see:
```
[Background] ⚠ API server not reachable
```
Make sure the API server is running (Step 2).

---

## 🎬 Step 5: Start Scraping

### 1. Navigate to Collabstr
```
https://collabstr.com/influencers?ph_id=622942&p=instagram
```

### 2. Apply Your Filters
- Platform: Instagram, TikTok, YouTube, etc.
- Niche: Beauty, Tech, Fashion, etc.
- Followers: Set min/max
- Location: Any country

### 3. Click Extension Icon
Click the purple extension icon in your toolbar

### 4. Click "Start Scraping"
Watch it work:
- Page scrolls automatically ✓
- Profiles extracted ✓
- Data sent to API ✓
- Saved to SQLite database ✓
- Moves to next page ✓

---

## 📊 Step 6: View Your Data

### Method 1: API Endpoints

**Get Statistics:**
```bash
curl http://localhost:4000/api/stats
```

Response:
```json
{
  "totalProfiles": 240,
  "uniqueProfiles": 235,
  "totalPages": 10,
  "profilesPerPage": [...]
}
```

**Export CSV:**
```
http://localhost:4000/api/export/csv
```
Opens download dialog with CSV file

### Method 2: Direct Database Access

**Using SQLite Command Line:**
```bash
cd api
sqlite3 collabstr_profiles.db
```

```sql
SELECT * FROM profiles LIMIT 10;
SELECT COUNT(*) FROM profiles;
SELECT DISTINCT id FROM profiles;
```

**Using DB Browser for SQLite:**
1. Download [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Open `api/collabstr_profiles.db`
3. Browse data visually
4. Export to CSV/JSON/Excel

### Method 3: Export Button in Extension

Click **"Export CSV"** button in extension popup → Downloads CSV with all profiles

---

## 🗄️ Database Structure

### profiles table
```sql
CREATE TABLE profiles (
  id TEXT,              -- Profile username
  page INTEGER,         -- Page number (1, 2, 3...)
  scraped_at DATETIME,  -- Timestamp
  session_id TEXT,      -- Scraping session ID
  PRIMARY KEY (id, page, session_id)
)
```

### sessions table
```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  started_at DATETIME,
  ended_at DATETIME,
  total_profiles INTEGER,
  total_pages INTEGER,
  filters TEXT          -- JSON of applied filters
)
```

---

## 🔄 Workflow

### Complete Scraping Session:

1. **Start API** → `npm start` in api folder
2. **Load Extension** → Chrome loads background.js
3. **Background connects to API** → Verifies server is running
4. **Navigate to Collabstr** → Apply filters
5. **Click "Start Scraping"** → Extension sends START_SCRAPING
6. **Background starts session** → POST /api/session/start
7. **Content script scrapes page** → Extracts profile IDs
8. **Background receives IDs** → Formats data
9. **Background sends to API** → POST /api/profiles
10. **API saves to SQLite** → INSERT INTO profiles
11. **Extension moves to next page** → Repeat steps 7-10
12. **No more pages** → Extension sends STOP_SCRAPING
13. **Background ends session** → POST /api/session/end
14. **Done!** → Data in SQLite database

---

## 🛠️ Configuration

### Change API Port

Edit `api/server.js`:
```javascript
const PORT = process.env.PORT || 4000; // Change to 5000, 3000, etc.
```

Also update `background.js`:
```javascript
const API_URL = 'http://localhost:4000/api'; // Match new port
```

### API on Different Machine

If API runs on another computer:

1. Edit `api/server.js`:
```javascript
app.listen(PORT, '0.0.0.0', () => {
  // Binds to all network interfaces
});
```

2. Find API server's IP address
3. Update `background.js`:
```javascript
const API_URL = 'http://192.168.1.XXX:4000/api';
```

---

## 🐛 Troubleshooting

### Extension Can't Connect to API

**Problem:** `⚠ API server not reachable`

**Solutions:**
1. Check API server is running: `npm start` in api folder
2. Check port 4000 is not blocked by firewall
3. Test manually: Visit `http://localhost:4000/` in browser
4. Check background.js has correct URL

### Database Locked

**Problem:** `Error: database is locked`

**Solutions:**
1. Close DB Browser for SQLite
2. Close any other programs accessing the .db file
3. Restart API server

### Port Already in Use

**Problem:** `EADDRINUSE: address already in use :::4000`

**Solutions:**
1. Kill process on port 4000:
   ```bash
   # Windows
   netstat -ano | findstr :4000
   taskkill /PID <PID> /F

   # Mac/Linux
   lsof -i :4000
   kill -9 <PID>
   ```
2. Or change port in server.js

### No Profiles Being Saved

**Check these:**
1. ✓ API server running
2. ✓ Extension connected to API
3. ✓ Content script finding profiles (check page console)
4. ✓ No errors in API server terminal
5. ✓ Check `api/collabstr_profiles.db` file exists

---

## 📁 Project Structure

```
Pluign/
├── manifest.json          # Extension config
├── background.js          # Sends data to API ← NO MORE SQL.JS!
├── content.js             # Scrapes pages
├── popup.html             # UI
├── popup.js               # UI logic
├── icon*.png              # Extension icons
│
├── api/                   # ← NEW! API Server folder
│   ├── package.json       # API dependencies
│   ├── server.js          # Express API with SQLite
│   ├── collabstr_profiles.db  # SQLite database (created automatically)
│   └── README.md          # API documentation
│
└── SETUP_API.md           # This file
```

---

## ✨ Benefits of This Setup

### Before (sql.js in extension):
- ❌ WASM CSP errors
- ❌ Limited to Chrome storage (10MB)
- ❌ Difficult to query data
- ❌ No SQL tools work directly
- ❌ Complex export process

### After (API + SQLite):
- ✅ No CSP issues
- ✅ Unlimited storage
- ✅ Real SQL database
- ✅ Use any SQLite tool
- ✅ Easy CSV export
- ✅ Track multiple sessions
- ✅ Can add authentication later
- ✅ Can deploy API to cloud
- ✅ Multiple extensions can share data

---

## 🚀 Next Steps

### You're All Set! Now you can:

1. **Scrape profiles** → Extension + API working together
2. **View in database** → Use DB Browser for SQLite
3. **Export data** → CSV, JSON, SQL
4. **Run queries** → Full SQL power
5. **Track sessions** → See all scraping runs
6. **Scale up** → Deploy API to cloud later

### Advanced Usage:

- **Multiple sessions**: Run different filter combinations
- **API analytics**: Build dashboards with the data
- **Automation**: Schedule scraping with cron jobs
- **Export formats**: JSON, XML, custom formats
- **Data processing**: Python scripts to analyze profiles

---

## 📚 Documentation

- **[api/README.md](api/README.md)** - Complete API documentation
- **[README.md](README.md)** - Extension documentation
- **[DEBUG.md](DEBUG.md)** - Troubleshooting guide

---

## 🎉 Summary

You now have a professional-grade scraping system:

- ✅ Chrome extension scrapes data
- ✅ Node.js API processes requests
- ✅ SQLite database stores everything
- ✅ No more WASM/CSP issues
- ✅ Real database you can query
- ✅ Easy to export and analyze

**Happy scraping!** 🚀
