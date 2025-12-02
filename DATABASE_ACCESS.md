# Accessing Your SQLite Database

This extension stores all scraped data in a SQLite database. Here's how to access and use it.

## Database Schema

```sql
CREATE TABLE profiles (
  id TEXT,
  page INTEGER,
  scraped_at DATETIME,
  PRIMARY KEY (id, page)
)
```

**Fields:**
- `id`: Profile username (e.g., "adilmalnick", "derekpinder")
- `page`: Page number where the profile was found (1, 2, 3, etc.)
- `scraped_at`: ISO 8601 timestamp (e.g., "2025-12-02T10:30:15.123Z")

## How Data is Written

1. After scraping each page, the extension:
   - Extracts all profile IDs
   - Gets the current page number from the URL
   - Records the current timestamp
   - Writes all profiles to SQLite with `INSERT OR IGNORE` (prevents duplicates)

2. The database is immediately saved to `chrome.storage.local` after each page

3. Duplicates are prevented: Same ID on the same page won't be added twice

## Accessing the Database

### Method 1: Chrome DevTools (View Data)

1. Right-click the extension icon → "Inspect"
2. Go to **Console** tab
3. Paste this code to view all profiles:

```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  if (result.sqliteDB) {
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
  }
});
```

### Method 2: Export Database File

1. Open Chrome DevTools Console on the extension
2. Run this code to download the database:

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
  }
});
```

3. Open the downloaded `.db` file with any SQLite viewer:
   - [DB Browser for SQLite](https://sqlitebrowser.org/) (free, cross-platform)
   - [SQLite Viewer Online](https://inloop.github.io/sqlite-viewer/)
   - Command line: `sqlite3 collabstr-profiles-*.db`

### Method 3: Query Specific Data

Get count of unique profiles:
```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const res = db.exec('SELECT COUNT(DISTINCT id) as total FROM profiles');
  console.log('Total unique profiles:', res[0].values[0][0]);
});
```

Get profiles from a specific page:
```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const pageNum = 1; // Change this
  const res = db.exec('SELECT * FROM profiles WHERE page = ?', [pageNum]);
  console.table(res[0].values);
});
```

Get profiles scraped in last hour:
```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const res = db.exec(
    'SELECT * FROM profiles WHERE scraped_at > ? ORDER BY scraped_at DESC',
    [oneHourAgo]
  );
  console.table(res[0].values);
});
```

### Method 4: Export to CSV

```javascript
chrome.storage.local.get(['sqliteDB'], async (result) => {
  const SQL = await initSqlJs({
    locateFile: file => chrome.runtime.getURL(file)
  });
  const db = new SQL.Database(new Uint8Array(result.sqliteDB));
  const res = db.exec('SELECT id, page, scraped_at FROM profiles ORDER BY page, id');

  // Convert to CSV
  let csv = 'id,page,scraped_at\n';
  res[0].values.forEach(row => {
    csv += `${row[0]},${row[1]},${row[2]}\n`;
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collabstr-profiles-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
```

## Storage Location

The database is stored in Chrome's local storage:
- Path: `chrome.storage.local.sqliteDB`
- Format: Array of bytes (Uint8Array)
- Persistence: Survives browser restarts
- Scope: Per extension, per Chrome profile

## Database Size Limits

- Chrome storage limit: ~10 MB (can request more)
- Estimated capacity: ~500,000 profiles
- Each profile entry: ~50-100 bytes

## Tips

1. **Regular Backups**: Export your database file periodically
2. **Query Performance**: SQLite is very fast, even with 100k+ rows
3. **Data Analysis**: Import CSV into Excel, Google Sheets, or pandas
4. **Clean Old Data**: Use the "Clear Database" button to start fresh

## Example Use Cases

### Find profiles on multiple pages
```sql
SELECT id, GROUP_CONCAT(page) as pages, COUNT(*) as appearances
FROM profiles
GROUP BY id
HAVING COUNT(*) > 1
ORDER BY appearances DESC;
```

### Analyze scraping timeline
```sql
SELECT DATE(scraped_at) as date, COUNT(*) as profiles_scraped
FROM profiles
GROUP BY DATE(scraped_at)
ORDER BY date DESC;
```

### Get unique profile list
```sql
SELECT DISTINCT id FROM profiles ORDER BY id;
```
