# Collabstr Profile Scraper Chrome Extension

A powerful Chrome extension that automatically scrapes influencer profile IDs from Collabstr.com, stores them in a local SQLite database with page numbers and timestamps, and handles pagination seamlessly.

## ✨ Features

- **Automatic Scraping**: Extracts profile IDs from Collabstr influencer listings
- **SQLite Database**: Stores data locally with profile ID, page number, and timestamp
- **Smart Pagination**: Automatically navigates through all pages until complete
- **Duplicate Prevention**: Prevents same ID on same page from being added twice
- **Real-time Stats**: Beautiful UI showing profiles scraped and pages processed
- **Immediate Persistence**: Database writes after each page (no data loss)
- **Filter Support**: Works with any Collabstr filter combination

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd Pluign
npm install

# 2. Generate icons (open in browser)
# Open generate-icons.html and download all icons

# 3. Load in Chrome
# chrome://extensions/ → Developer mode ON → Load unpacked
```

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

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
- **[DATABASE_ACCESS.md](DATABASE_ACCESS.md)** - Complete guide to accessing and exporting data
- **[manifest.json](manifest.json)** - Extension configuration
- **[package.json](package.json)** - npm dependencies

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
