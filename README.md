# Collabstr Profile Scraper Chrome Extension

A powerful Chrome extension that automatically scrapes influencer profile IDs from Collabstr.com, stores them in a local SQLite database with page numbers and timestamps, and handles pagination seamlessly.

---

**📚 Table of Contents**

| Section | Description |
|---------|-------------|
| [Features](#-features) | What this extension can do |
| [Quick Start](#-complete-guide-from-start-to-finish) | Get started in 5 minutes |
| [Installation](#-installation) | Detailed setup instructions |
| [Usage Guide](#-usage-guide) | How to scrape profiles |
| [**Getting Your Data**](#-getting-your-scraped-data) | **Export to CSV/Excel/JSON** |
| [Complete Workflow](#-complete-workflow-example) | Real example start to finish |
| [Troubleshooting](#-troubleshooting) | Fix common issues |
| [Customization](#-customization) | Advanced configuration |

---

## ✨ Features

- **Automatic Scraping**: Extracts profile IDs from Collabstr influencer listings
- **SQLite Database**: Stores data locally with profile ID, page number, and timestamp
- **Smart Pagination**: Automatically navigates through all pages until complete
- **Duplicate Prevention**: Prevents same ID on same page from being added twice
- **Real-time Stats**: Beautiful UI showing profiles scraped and pages processed
- **Immediate Persistence**: Database writes after each page (no data loss)
- **Filter Support**: Works with any Collabstr filter combination

## 🚀 Complete Guide: From Start to Finish

### Quick Overview
```bash
# 1. Install dependencies
cd Pluign
npm install

# 2. Generate icons
# Open generate-icons.html and download all icons

# 3. Load in Chrome
# chrome://extensions/ → Developer mode ON → Load unpacked

# 4. Scrape profiles
# Navigate to Collabstr → Click extension icon → Start Scraping

# 5. Access your data
# See "Getting Your Scraped Data" section below
```

### Complete Step-by-Step Tutorial

Follow this guide to go from installation to getting your data:

**📥 Step 1: Install** → **🔧 Step 2: Setup** → **▶️ Step 3: Scrape** → **📊 Step 4: Get Data**

## 📦 Installation

### Prerequisites

- **Node.js & npm** (recommended) - [Download here](https://nodejs.org/)
- **Google Chrome** browser
- Basic command line knowledge

### Step 1: Install Dependencies

**Option A: Using npm (Recommended)**

```bash
cd Pluign
npm install
```

This automatically:
- Downloads sql.js (v1.10.3) from npm
- Copies `sql.js` and `sql-wasm.wasm` to the extension directory
- Verifies installation

**Option B: Manual Download**

If you don't have npm:

1. Download from [sql.js releases](https://github.com/sql-js/sql.js/releases/latest)
2. Extract `sqljs-wasm.zip`
3. Copy files:
   - `sql-wasm.js` → rename to `sql.js`
   - `sql-wasm.wasm` → keep as is
4. Place both files in the `Pluign` directory

**Option C: Using Setup Scripts**

- **Windows**: Double-click `setup.bat`
- **Mac/Linux**: Run `chmod +x setup.sh && ./setup.sh`

### Step 2: Generate Extension Icons

You need three icon sizes: 16x16, 48x48, and 128x128 pixels.

**Easy Method**: Open `generate-icons.html` in your browser
- Click "Download All Icons"
- Icons are automatically saved to your Downloads folder
- Move them to the `Pluign` directory

**Custom Icons**: Create your own PNG icons with any image editor

### Step 3: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `Pluign` folder
5. Extension should now appear in your toolbar

**Verify Installation:**
- Extension icon appears in Chrome toolbar
- No errors shown in `chrome://extensions/`
- Click icon to see popup interface

## 📖 Usage Guide

### Starting Your First Scrape

1. **Navigate to Collabstr**
   ```
   https://collabstr.com/influencers?ph_id=622942&p=instagram
   ```

2. **Apply Filters** (optional)
   - Platform: Instagram, TikTok, YouTube, etc.
   - Niche: Beauty, Fashion, Tech, etc.
   - Followers: Min/max follower counts
   - The URL updates automatically with your selections

3. **Start Scraping**
   - Click the extension icon in your toolbar
   - Click **Start Scraping** button
   - Watch the magic happen!

4. **Monitor Progress**
   - Real-time profile count
   - Current page number
   - Status updates

### What Happens During Scraping

```
Page 1 → Extract IDs → Save to DB (id, page=1, timestamp)
         ↓
Page 2 → Extract IDs → Save to DB (id, page=2, timestamp)
         ↓
Page 3 → Extract IDs → Save to DB (id, page=3, timestamp)
         ↓
   ... continues until no more results ...
         ↓
      Complete!
```

### Stopping and Resuming

- **Stop**: Click "Stop Scraping" at any time
- **Resume**: Navigate back to your Collabstr page and click "Start Scraping"
- All previous data is preserved in the database

### Accessing Your Data

The extension stores all data in a SQLite database. You have several options:

#### Quick Access via Chrome DevTools

1. Right-click extension icon → Inspect
2. Go to Console tab
3. View all data:
   ```javascript
   chrome.storage.local.get(['profileCount', 'pageCount'], console.log);
   ```

#### Export Database File

See [DATABASE_ACCESS.md](DATABASE_ACCESS.md) for detailed instructions on:
- Exporting the SQLite database file
- Viewing data with DB Browser for SQLite
- Exporting to CSV for Excel/Sheets
- Running custom SQL queries
- Analyzing your data

#### Example Queries

```sql
-- Get all unique profiles
SELECT DISTINCT id FROM profiles ORDER BY id;

-- Count profiles per page
SELECT page, COUNT(*) as count FROM profiles GROUP BY page;

-- Find profiles appearing on multiple pages
SELECT id, COUNT(*) as pages FROM profiles GROUP BY id HAVING pages > 1;

-- Recent scrapes (last 24 hours)
SELECT * FROM profiles
WHERE scraped_at > datetime('now', '-1 day')
ORDER BY scraped_at DESC;
```

### Clearing Data

- Click **Clear Database** in the popup
- Confirms before deleting all data
- Cannot be undone - use with caution!

## 📊 Getting Your Scraped Data

Once you've scraped profiles, here's how to access and use your data:

### Method 1: Export Database to SQLite File (Recommended)

**Step 1: Open Background Console**
1. Go to `chrome://extensions/`
2. Find "Collabstr Profile Scraper"
3. Click **"service worker"** (under "Inspect views")
4. DevTools Console opens

**Step 2: Export Database**

Paste this code in the console and press Enter:

```javascript
chrome.storage.local.get(['sqliteDB'], (result) => {
  if (result.sqliteDB) {
    const blob = new Blob([new Uint8Array(result.sqliteDB)], {
      type: 'application/x-sqlite3'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabstr-profiles-${Date.now()}.db`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('✓ Database exported!');
  } else {
    console.log('✗ No database found');
  }
});
```

**Step 3: Open the Database**

Download and install [DB Browser for SQLite](https://sqlitebrowser.org/) (free, cross-platform)

1. Open DB Browser for SQLite
2. Click **"Open Database"**
3. Select your downloaded `.db` file
4. Click **"Browse Data"** tab
5. Select **"profiles"** table
6. You'll see all your data: `id`, `page`, `scraped_at`

**Step 4: Export to CSV/Excel**

In DB Browser:
1. Go to **File** → **Export** → **Table(s) as CSV file**
2. Select "profiles" table
3. Save as `.csv`
4. Open in Excel, Google Sheets, or any spreadsheet software

### Method 2: Export to CSV Directly from Browser

**Paste this code in Background Console:**

```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  if (!result.sqliteDB) {
    console.log('No database found');
    return;
  }

  // Initialize sql.js
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });

  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const res = db.exec('SELECT id, page, scraped_at FROM profiles ORDER BY page, id');

  if (res.length === 0) {
    console.log('No profiles found');
    return;
  }

  // Create CSV
  let csv = 'id,page,scraped_at\n';
  res[0].values.forEach(row => {
    csv += `${row[0]},${row[1]},${row[2]}\n`;
  });

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collabstr-profiles-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  console.log('✓ CSV exported with', res[0].values.length, 'profiles');
});
```

### Method 3: View Data in Console

**Quick view of all profiles:**

```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const res = db.exec('SELECT * FROM profiles ORDER BY page, id');

  console.table(res[0].values.map(row => ({
    id: row[0],
    page: row[1],
    scraped_at: row[2]
  })));
});
```

**Get statistics:**

```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));

  // Total profiles
  const total = db.exec('SELECT COUNT(*) FROM profiles');
  console.log('Total profiles:', total[0].values[0][0]);

  // Unique profiles
  const unique = db.exec('SELECT COUNT(DISTINCT id) FROM profiles');
  console.log('Unique profiles:', unique[0].values[0][0]);

  // Profiles per page
  const perPage = db.exec('SELECT page, COUNT(*) as count FROM profiles GROUP BY page ORDER BY page');
  console.log('Profiles per page:');
  console.table(perPage[0].values.map(row => ({page: row[0], count: row[1]})));
});
```

### Method 4: Export to JSON

```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const res = db.exec('SELECT id, page, scraped_at FROM profiles ORDER BY page, id');

  const profiles = res[0].values.map(row => ({
    id: row[0],
    page: row[1],
    scraped_at: row[2]
  }));

  const json = JSON.stringify(profiles, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collabstr-profiles-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log('✓ JSON exported with', profiles.length, 'profiles');
});
```

## 🎯 Complete Workflow Example

Here's a real example from start to finish:

### Step 1: Install Extension (5 minutes)

```bash
cd Pluign
npm install
```

Open `generate-icons.html` → Download icons → Move to Pluign folder

Load extension in Chrome:
- `chrome://extensions/`
- Enable Developer mode
- Load unpacked → Select Pluign folder

### Step 2: Navigate and Configure (1 minute)

Go to Collabstr and apply filters:
```
https://collabstr.com/influencers?ph_id=622942&p=instagram
```

Filters you might use:
- Platform: Instagram
- Niche: Beauty & Fashion
- Followers: 10k - 100k
- Location: United States

### Step 3: Start Scraping (Automatic)

1. Click extension icon in toolbar
2. Click **"Start Scraping"**
3. Watch the scraper work:
   - Page scrolls automatically
   - Stats update in real-time
   - Profiles saved to database
   - Moves to next page automatically

**What happens:**
- Page 1: Scrapes 24 profiles → Saves to DB
- Page 2: Scrapes 24 profiles → Saves to DB
- Page 3: Scrapes 24 profiles → Saves to DB
- ...continues until no more pages...
- **Done!**

### Step 4: Export Your Data (2 minutes)

**Option A - SQLite Database:**

1. `chrome://extensions/` → Click "service worker"
2. Paste export code (see Method 1 above)
3. Download `collabstr-profiles-XXXXX.db`
4. Open in DB Browser for SQLite
5. Export to CSV for Excel/Sheets

**Option B - Direct CSV:**

1. `chrome://extensions/` → Click "service worker"
2. Paste CSV export code (see Method 2 above)
3. Download `collabstr-profiles-XXXXX.csv`
4. Open in Excel/Google Sheets

### Step 5: Use Your Data

**In Excel/Google Sheets:**
- Sort by page number
- Filter by date
- Remove duplicates
- Create prospect lists
- Import to CRM

**SQL Analysis Examples:**

```sql
-- Get all unique profiles
SELECT DISTINCT id FROM profiles ORDER BY id;

-- Find profiles on multiple pages (high relevance)
SELECT id, COUNT(*) as appearances, GROUP_CONCAT(page) as pages
FROM profiles
GROUP BY id
HAVING appearances > 1
ORDER BY appearances DESC;

-- Profiles scraped today
SELECT * FROM profiles
WHERE DATE(scraped_at) = DATE('now')
ORDER BY page;

-- Count by scraping session (by date)
SELECT DATE(scraped_at) as date, COUNT(*) as profiles
FROM profiles
GROUP BY DATE(scraped_at);
```

**Python/Pandas Analysis:**

```python
import pandas as pd
import sqlite3

# Load database
conn = sqlite3.connect('collabstr-profiles-XXXXX.db')
df = pd.read_sql_query("SELECT * FROM profiles", conn)

# Basic stats
print(f"Total records: {len(df)}")
print(f"Unique profiles: {df['id'].nunique()}")
print(f"Pages scraped: {df['page'].max()}")

# Profiles per page
print(df.groupby('page').size())

# Export unique IDs
unique_ids = df['id'].unique()
pd.DataFrame(unique_ids, columns=['profile_id']).to_csv('unique_profiles.csv', index=False)
```

## 📋 Data Schema Reference

Your exported data will have these columns:

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | TEXT | Profile username/slug | `adilmalnick` |
| `page` | INTEGER | Page number where found | `1`, `2`, `3` |
| `scraped_at` | DATETIME | ISO 8601 timestamp | `2025-12-02T10:30:15.123Z` |

**Sample CSV Output:**
```csv
id,page,scraped_at
adilmalnick,1,2025-12-02T10:30:15.123Z
derekpinder,1,2025-12-02T10:30:15.123Z
amandajordan,1,2025-12-02T10:30:15.123Z
jasonsmith,2,2025-12-02T10:31:22.456Z
sarahwilliams,2,2025-12-02T10:31:22.456Z
```

**Building Profile URLs:**

Once you have the IDs, build full URLs:
```
https://collabstr.com/{id}
```

Example:
- ID: `adilmalnick`
- Full URL: `https://collabstr.com/adilmalnick`

## 🏗️ Architecture

### Component Overview

```
┌─────────────────────────────────────────────────┐
│                  Popup UI                        │
│  (popup.html + popup.js)                        │
│  - Start/Stop controls                          │
│  - Real-time statistics                         │
│  - Clear database                               │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│           Background Service Worker              │
│  (background.js)                                │
│  - SQLite database management                   │
│  - Pagination coordination                      │
│  - Data persistence                             │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│              Content Script                      │
│  (content.js)                                   │
│  - Runs on Collabstr pages                      │
│  - Extracts profile IDs from DOM                │
│  - Sends data to background                     │
└─────────────────────────────────────────────────┘
```

### How Profile Extraction Works

**HTML Structure on Collabstr:**
```html
<a class="profile-listing-link" href="/username?ph_id=622942&p=instagram">
  <!-- Profile card content -->
</a>
```

**Extraction Logic:**
```javascript
const elements = document.querySelectorAll('a.profile-listing-link');
const ids = [...elements].map(el => {
  const href = el.href;
  // Extract: https://collabstr.com/username?params → "username"
  return href.split("collabstr.com/")[1].split("?")[0];
});
```

**Result:** `["adilmalnick", "derekpinder", "amandajordan", ...]`

### Pagination Strategy

The extension manipulates the `pg` URL parameter:

```
Page 1: https://collabstr.com/influencers?ph_id=622942&p=instagram
Page 2: https://collabstr.com/influencers?ph_id=622942&p=instagram&pg=2
Page 3: https://collabstr.com/influencers?ph_id=622942&p=instagram&pg=3
...
```

**Detection Logic:**
- Page loads → Extract current page number from URL
- Scrape profiles → Save with page number
- Navigate to `pg = current + 1`
- If page has 0 profiles → Stop (reached end)

**Safety Features:**
- 2-second delay between pages (configurable)
- Waits for page load completion
- Handles network errors gracefully
- Stop button for manual interruption

## 💾 Database Schema

```sql
CREATE TABLE profiles (
  id TEXT,              -- Profile username (e.g., "adilmalnick")
  page INTEGER,         -- Page number where found (1, 2, 3, ...)
  scraped_at DATETIME,  -- ISO 8601 timestamp
  PRIMARY KEY (id, page)
)
```

### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | TEXT | Profile username/slug | `"adilmalnick"` |
| `page` | INTEGER | Page number in search results | `1`, `2`, `3` |
| `scraped_at` | DATETIME | When the profile was scraped | `"2025-12-02T10:30:15.123Z"` |

### Primary Key Strategy

- **Composite Key**: `(id, page)` allows same ID on different pages
- **Example**: User "john" appears on page 1 and page 5 → 2 separate records
- **Prevents Duplicates**: Same ID on same page won't insert twice (`INSERT OR IGNORE`)

### Storage Details

- **Location**: `chrome.storage.local.sqliteDB`
- **Format**: Uint8Array (binary SQLite database)
- **Persistence**: Survives browser restarts
- **Size Limit**: ~10 MB default (can request more)
- **Estimated Capacity**: 500,000+ profiles

## 🔧 Customization

### Adjust Scraping Speed

Edit `background.js` around line 167:

```javascript
setTimeout(async () => {
  // Navigate to next page
}, 2000); // Change delay (milliseconds)
```

**Recommendations:**
- **Fast servers**: 1000ms (1 second)
- **Default**: 2000ms (2 seconds)
- **Slow connections**: 3000-5000ms

### Extract Additional Data

**Step 1**: Modify `content.js` to extract more fields:

```javascript
const profiles = [...elements].map(el => {
  return {
    id: extractId(el),
    name: el.querySelector('.profile-name')?.textContent,
    followers: el.querySelector('.follower-count')?.textContent,
    platform: el.querySelector('.platform')?.textContent,
    // Add more fields as needed
  };
});
```

**Step 2**: Update database schema in `background.js`:

```sql
CREATE TABLE profiles (
  id TEXT,
  page INTEGER,
  name TEXT,
  followers TEXT,
  platform TEXT,
  scraped_at DATETIME,
  PRIMARY KEY (id, page)
)
```

**Step 3**: Update `insertProfiles()` function to handle new fields

### Change Database Structure

You can modify the table schema for different use cases:

```sql
-- Single record per profile (unique ID only)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  first_seen_page INTEGER,
  last_seen_page INTEGER,
  times_seen INTEGER,
  first_scraped DATETIME,
  last_scraped DATETIME
)

-- Track all pages where profile appears
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  pages TEXT,  -- JSON array: "[1,2,5]"
  scraped_at DATETIME
)
```

## 🐛 Troubleshooting

### Extension Won't Load

**Symptoms**: Error on `chrome://extensions/` page

**Solutions**:
- ✓ Verify all files present: `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `sql.js`, `sql-wasm.wasm`
- ✓ Check `sql.js` and `sql-wasm.wasm` exist in extension directory
- ✓ Run `npm install` again if files missing
- ✓ Check Chrome DevTools Console for specific errors
- ✓ Try removing and re-adding the extension

### Scraping Doesn't Start

**Symptoms**: Click "Start Scraping" but nothing happens

**Solutions**:
- ✓ Verify URL contains `/influencers` path
- ✓ Refresh the Collabstr page
- ✓ Check extension permissions in `chrome://extensions/`
- ✓ Open DevTools Console and look for errors
- ✓ Ensure content script is running (DevTools → Sources → Content Scripts)

### Database Not Saving

**Symptoms**: Profile count stays at 0

**Solutions**:
- ✓ Check Chrome DevTools → Application → Storage → Local Storage
- ✓ Look for `sqliteDB` entry
- ✓ Clear all data and start fresh
- ✓ Check available storage space
- ✓ Verify no browser extensions blocking storage

### Pagination Stops Early

**Symptoms**: Scraping stops before all pages

**Solutions**:
- ✓ Verify pages exist on actual Collabstr website
- ✓ Some filters may have fewer results than expected
- ✓ Increase delay in `background.js` if pages load slowly
- ✓ Check for network errors in DevTools Network tab
- ✓ Clear browser cache and try again

### Performance Issues

**Symptoms**: Browser slows down during scraping

**Solutions**:
- ✓ Increase delay between pages (reduce CPU usage)
- ✓ Close unnecessary tabs
- ✓ Scrape in smaller batches (stop and resume)
- ✓ Clear database periodically
- ✓ Export data and start fresh

## 📊 Use Cases

### Market Research
- Collect influencer lists for specific niches
- Analyze influencer distribution across platforms
- Track new influencers over time

### Outreach Campaigns
- Build targeted prospect lists
- Export to CRM or spreadsheet
- Track which pages have most relevant profiles

### Competitive Analysis
- See which influencers competitors might target
- Analyze follower count distributions
- Identify trending niches

### Data Analysis
- Export to pandas/R for statistical analysis
- Visualize trends over time
- Cross-reference with other datasets

## 📄 Additional Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get up and running in 5 minutes
- **[DATABASE_ACCESS.md](DATABASE_ACCESS.md)** - Advanced database queries and access methods
- **[DEBUG.md](DEBUG.md)** - Troubleshooting guide with console logging
- **[manifest.json](manifest.json)** - Extension configuration
- **[package.json](package.json)** - npm dependencies

## 🔗 Quick Links

| What You Need | Where to Go |
|---------------|-------------|
| **Install the extension** | See [Installation](#-installation) section above |
| **Start scraping** | See [Usage Guide](#-usage-guide) section |
| **Export your data** | See [Getting Your Scraped Data](#-getting-your-scraped-data) |
| **View complete workflow** | See [Complete Workflow Example](#-complete-workflow-example) |
| **Fix errors** | See [Troubleshooting](#-troubleshooting) or [DEBUG.md](DEBUG.md) |
| **SQL queries** | See [Database Access](DATABASE_ACCESS.md) |
| **Python analysis** | See code examples in [Complete Workflow](#step-5-use-your-data) |

## ⚠️ Legal & Ethics

**Important Considerations**:

1. **Terms of Service**: Review and comply with Collabstr's Terms of Service
2. **Rate Limiting**: Use reasonable delays to avoid overwhelming servers
3. **Privacy**: Handle scraped data responsibly
4. **Purpose**: For educational and research purposes only
5. **Respect**: Don't use data for spam or harassment

This tool is provided as-is for educational purposes. Users are responsible for their own compliance with applicable laws and terms of service.

## 🛠️ Technical Stack

- **[sql.js](https://github.com/sql-js/sql.js/)** v1.10.3 - SQLite compiled to WebAssembly
- **Chrome Extensions Manifest V3** - Modern extension architecture
- **Vanilla JavaScript** - No frameworks, pure performance
- **Chrome Storage API** - Persistent local storage
- **Chrome Tabs API** - Page navigation control
- **Chrome Scripting API** - Content script injection

## 🤝 Contributing

Found a bug? Have a feature request? Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is for educational purposes. Use responsibly and at your own risk.

## 🙏 Credits

Built with ❤️ using modern web technologies.

---

**Version**: 1.0.0
**Last Updated**: December 2025
**Compatibility**: Chrome 88+
