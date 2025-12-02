// Background service worker for managing SQLite DB and scraping coordination
import initSqlJs from './sql.js';

let db = null;
let isScrapingActive = false;
let currentTabId = null;
let scrapedPages = 0;

// Initialize SQLite database
async function initDB() {
  if (db) return db;

  try {
    const SQL = await initSqlJs({
      locateFile: file => chrome.runtime.getURL(file)
    });

    // Try to load existing database from storage
    const stored = await chrome.storage.local.get(['sqliteDB']);

    if (stored.sqliteDB) {
      // Restore from storage
      const uint8Array = new Uint8Array(stored.sqliteDB);
      db = new SQL.Database(uint8Array);
    } else {
      // Create new database
      db = new SQL.Database();

      // Create profiles table
      db.run(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT,
          page INTEGER,
          scraped_at DATETIME,
          PRIMARY KEY (id, page)
        )
      `);

      await saveDB();
    }

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return null;
  }
}

// Save database to storage
async function saveDB() {
  if (!db) return;

  try {
    const data = db.export();
    await chrome.storage.local.set({ sqliteDB: Array.from(data) });
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

// Get profile count from database
function getProfileCount() {
  if (!db) return 0;

  try {
    const result = db.exec('SELECT COUNT(*) as count FROM profiles');
    return result[0]?.values[0][0] || 0;
  } catch (error) {
    console.error('Failed to get profile count:', error);
    return 0;
  }
}

// Insert profile IDs into database
async function insertProfiles(ids, pageNumber) {
  if (!db || !ids || ids.length === 0) return;

  try {
    // Get current date in ISO format
    const currentDate = new Date().toISOString();

    const stmt = db.prepare('INSERT OR IGNORE INTO profiles (id, page, scraped_at) VALUES (?, ?, ?)');

    for (const id of ids) {
      stmt.bind([id, pageNumber, currentDate]);
      stmt.step();
      stmt.reset();
    }

    stmt.free();
    await saveDB();

    console.log(`Saved ${ids.length} profiles from page ${pageNumber} to database`);

    // Update stats
    await updateStats();
  } catch (error) {
    console.error('Failed to insert profiles:', error);
  }
}

// Update stats in storage
async function updateStats() {
  const profileCount = getProfileCount();

  await chrome.storage.local.set({
    profileCount: profileCount,
    pageCount: scrapedPages
  });

  // Notify popup to update UI
  chrome.runtime.sendMessage({ type: 'UPDATE_STATS' }).catch(() => {
    // Popup might be closed, ignore error
  });
}

// Extract page number from URL
function getPageNumber(url) {
  try {
    const urlObj = new URL(url);
    return parseInt(urlObj.searchParams.get('pg')) || 1;
  } catch (error) {
    return 1;
  }
}

// Increment page number in URL
function incrementPageNumber(url) {
  try {
    const urlObj = new URL(url);
    const current = getPageNumber(url);
    urlObj.searchParams.set('pg', current + 1);
    return urlObj.toString();
  } catch (error) {
    return null;
  }
}

// Handle scraped IDs from content script
async function handleScrapedIDs(ids, hasResults, url) {
  if (!isScrapingActive) return;

  // If no results, we've reached the end
  if (!hasResults || ids.length === 0) {
    await stopScraping();
    console.log('=== Scraping complete - no more results ===');
    return;
  }

  // Get current page number from URL
  const pageNumber = getPageNumber(url);

  // Store IDs in database with page number and date
  await insertProfiles(ids, pageNumber);

  scrapedPages++;
  await updateStats();

  console.log(`Scraped page ${pageNumber}: ${ids.length} profiles`);

  // Navigate to next page after a short delay
  setTimeout(async () => {
    if (isScrapingActive && currentTabId) {
      const nextUrl = incrementPageNumber(url);

      if (nextUrl) {
        try {
          await chrome.tabs.update(currentTabId, { url: nextUrl });
        } catch (error) {
          console.error('Failed to navigate to next page:', error);
          await stopScraping();
        }
      } else {
        await stopScraping();
      }
    }
  }, 2000); // 2 second delay between pages
}

// Start scraping
async function startScraping(tabId) {
  if (isScrapingActive) return;

  await initDB();

  isScrapingActive = true;
  currentTabId = tabId;
  scrapedPages = 0;

  await chrome.storage.local.set({ isScrapingActive: true });

  // Notify content script to start scraping
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SCRAPING_STARTED' });
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }

  console.log('=== Scraping started ===');
}

// Stop scraping
async function stopScraping() {
  isScrapingActive = false;
  await chrome.storage.local.set({ isScrapingActive: false });

  if (currentTabId) {
    try {
      await chrome.tabs.sendMessage(currentTabId, { type: 'SCRAPING_STOPPED' });
    } catch (error) {
      // Tab might be closed, ignore error
    }
  }

  currentTabId = null;
  console.log('=== Scraping stopped ===');

  await updateStats();
}


// Clear database
async function clearDatabase() {
  if (!db) return;

  try {
    db.run('DELETE FROM profiles');
    await saveDB();

    scrapedPages = 0;
    await chrome.storage.local.set({
      profileCount: 0,
      pageCount: 0
    });

    await updateStats();

    console.log('=== Database cleared ===');
  } catch (error) {
    console.error('Failed to clear database:', error);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'START_SCRAPING':
          await startScraping(message.tabId);
          sendResponse({ success: true });
          break;

        case 'STOP_SCRAPING':
          await stopScraping();
          sendResponse({ success: true });
          break;

        case 'SCRAPED_IDS':
          await handleScrapedIDs(message.ids, message.hasResults, message.url);
          sendResponse({ success: true });
          break;

        case 'CLEAR_DATABASE':
          await clearDatabase();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

// Initialize database on extension load
initDB().then(() => {
  console.log('Database initialized');
  updateStats();
});

// Handle tab updates (page loads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    isScrapingActive &&
    tabId === currentTabId &&
    changeInfo.status === 'complete' &&
    tab.url &&
    tab.url.includes('collabstr.com/influencers')
  ) {
    // Page has loaded, notify content script to scrape
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'SCRAPING_STARTED' }).catch(() => {
        // Content script might not be ready yet, ignore
      });
    }, 1000);
  }
});
