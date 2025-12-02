// Background service worker - sends data to API server
// No sql.js - uses Node.js API with real SQLite database!

const API_URL = 'http://localhost:4000/api';

let isScrapingActive = false;
let currentTabId = null;
let currentSessionId = null;

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`[Background] API request failed (${endpoint}):`, error);
    throw error;
  }
}

// Start a new scraping session
async function startSession(filters = {}) {
  try {
    const result = await apiRequest('/session/start', 'POST', { filters });
    currentSessionId = result.sessionId;
    console.log('[Background] Started session:', currentSessionId);
    return currentSessionId;
  } catch (error) {
    console.error('[Background] Failed to start session:', error);
    // Fallback to timestamp-based session ID
    currentSessionId = `session_${Date.now()}`;
    return currentSessionId;
  }
}

// End scraping session
async function endSession() {
  if (!currentSessionId) return;

  try {
    await apiRequest('/session/end', 'POST', { sessionId: currentSessionId });
    console.log('[Background] Ended session:', currentSessionId);
  } catch (error) {
    console.error('[Background] Failed to end session:', error);
  }
}

// Save profiles to API
async function saveProfiles(profiles) {
  try {
    const result = await apiRequest('/profiles', 'POST', {
      profiles,
      sessionId: currentSessionId
    });

    console.log(`[Background] ✓ Saved ${result.inserted} profiles to API`);
    return result;
  } catch (error) {
    console.error('[Background] Failed to save profiles to API:', error);
    // Fallback: save to local storage
    console.log('[Background] Falling back to local storage');
    const { profilesData = [] } = await chrome.storage.local.get(['profilesData']);
    profilesData.push(...profiles);
    await chrome.storage.local.set({ profilesData });
  }
}

// Get statistics from API
async function getStats() {
  try {
    const result = await apiRequest(`/stats?sessionId=${currentSessionId || ''}`);
    return result.stats;
  } catch (error) {
    console.error('[Background] Failed to get stats from API:', error);
    // Fallback to local storage count
    const { profilesData = [] } = await chrome.storage.local.get(['profilesData']);
    return {
      totalProfiles: profilesData.length,
      uniqueProfiles: new Set(profilesData.map(p => p.id)).size,
      totalPages: Math.max(...profilesData.map(p => p.page), 0)
    };
  }
}

// Update stats in storage and notify popup
async function updateStats() {
  try {
    const stats = await getStats();

    await chrome.storage.local.set({
      profileCount: stats.totalProfiles
      // pageCount is updated in handleScrapedIDs with actual URL page number
    });

    // Notify popup to update UI
    chrome.runtime.sendMessage({ type: 'UPDATE_STATS' }).catch(() => {
      // Popup might be closed, ignore error
    });
  } catch (error) {
    console.error('[Background] Failed to update stats:', error);
  }
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
  console.log('[Background] handleScrapedIDs called:', { idsCount: ids?.length, hasResults, url });

  if (!isScrapingActive) {
    console.warn('[Background] Not scraping, ignoring scraped IDs');
    return;
  }

  // If no results, we've reached the end
  if (!hasResults || ids.length === 0) {
    console.log('[Background] No more results found, stopping scraper');
    await stopScraping(true); // Clear resume data since scraping completed successfully
    console.log('[Background] === Scraping complete - no more results ===');
    return;
  }

  // Get current page number from URL
  const pageNumber = getPageNumber(url);
  console.log('[Background] Processing page', pageNumber, 'with', ids.length, 'profiles');

  // Save last page info for resume functionality
  await chrome.storage.local.set({
    lastScrapedPage: pageNumber,
    lastScrapedUrl: url,
    canResume: true
  });

  // Prepare profiles for API
  const currentDate = new Date().toISOString();
  const profiles = ids.map(id => ({
    id,
    page: pageNumber,
    scraped_at: currentDate
  }));

  // Save to API
  await saveProfiles(profiles);

  // Update stats with actual page number from URL (not just counter)
  await chrome.storage.local.set({
    pageCount: pageNumber
  });
  await updateStats();

  console.log(`[Background] ✓ Scraped page ${pageNumber}: ${ids.length} profiles`);

  // Note: Content script will handle clicking Next button
  // No need to navigate from background anymore
}

// Start scraping
async function startScraping(tabId) {
  console.log('[Background] startScraping called with tabId:', tabId);

  if (isScrapingActive) {
    console.warn('[Background] Scraping already active, ignoring');
    return;
  }

  // Get current tab URL to extract filters
  const tab = await chrome.tabs.get(tabId);
  const urlParams = new URL(tab.url).searchParams;
  const filters = {
    platform: urlParams.get('p') || 'unknown',
    ph_id: urlParams.get('ph_id') || 'unknown'
  };

  // Start session
  console.log('[Background] Starting API session...');
  await startSession(filters);

  isScrapingActive = true;
  currentTabId = tabId;

  console.log('[Background] Setting storage state to active');
  await chrome.storage.local.set({
    isScrapingActive: true,
    pageCount: getPageNumber(tab.url) // Set initial page number
  });

  // Notify content script to start scraping
  try {
    console.log('[Background] Sending SCRAPING_STARTED message to tab', tabId);
    const response = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPING_STARTED' });
    console.log('[Background] Content script response:', response);
  } catch (error) {
    console.error('[Background] Failed to notify content script:', error);
    console.error('[Background] Error details:', error.message);
  }

  console.log('[Background] === Scraping started successfully ===');
  await updateStats();
}

// Stop scraping
async function stopScraping(clearResume = false) {
  isScrapingActive = false;
  await chrome.storage.local.set({ isScrapingActive: false });

  if (currentTabId) {
    try {
      await chrome.tabs.sendMessage(currentTabId, { type: 'SCRAPING_STOPPED' });
    } catch (error) {
      // Tab might be closed, ignore error
    }
  }

  // End session
  await endSession();

  // Clear resume data if requested (e.g., when scraping completes successfully or user manually stops)
  if (clearResume) {
    await chrome.storage.local.set({
      canResume: false,
      lastScrapedPage: null,
      lastScrapedUrl: null
    });
    console.log('[Background] Resume data cleared');
  }

  currentTabId = null;
  currentSessionId = null;
  console.log('[Background] === Scraping stopped ===');

  await updateStats();
}

// Export profiles
async function exportProfiles() {
  try {
    // Try to get from API
    const result = await apiRequest(`/profiles?sessionId=${currentSessionId || ''}`);
    return result.profiles || [];
  } catch (error) {
    console.error('[Background] Failed to export from API:', error);
    // Fallback to local storage
    const { profilesData = [] } = await chrome.storage.local.get(['profilesData']);
    return profilesData;
  }
}

// Clear database
async function clearDatabase() {
  try {
    // Clear from API
    if (currentSessionId) {
      await apiRequest(`/profiles?sessionId=${currentSessionId}`, 'DELETE');
    } else {
      await apiRequest('/profiles', 'DELETE');
    }

    // Also clear local storage
    await chrome.storage.local.set({
      profilesData: [],
      profileCount: 0,
      pageCount: 0
    });

    console.log('[Background] === Database cleared ===');
  } catch (error) {
    console.error('[Background] Failed to clear database:', error);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type, 'from:', sender.tab?.id || 'popup');

  (async () => {
    try {
      switch (message.type) {
        case 'START_SCRAPING':
          console.log('[Background] Processing START_SCRAPING');
          await startScraping(message.tabId);
          sendResponse({ success: true });
          break;

        case 'RESUME_SCRAPING':
          console.log('[Background] Processing RESUME_SCRAPING');
          const { lastScrapedUrl } = await chrome.storage.local.get(['lastScrapedUrl']);
          if (lastScrapedUrl) {
            // Navigate to the last scraped page
            const tab = await chrome.tabs.get(message.tabId);
            await chrome.tabs.update(message.tabId, { url: lastScrapedUrl });
            // Wait for navigation, then start scraping
            setTimeout(async () => {
              await startScraping(message.tabId);
            }, 2000);
          } else {
            // No saved page, just start normally
            await startScraping(message.tabId);
          }
          sendResponse({ success: true });
          break;

        case 'STOP_SCRAPING':
          console.log('[Background] Processing STOP_SCRAPING');
          await stopScraping(true); // Clear resume data when manually stopped
          sendResponse({ success: true });
          break;

        case 'GET_RESUME_INFO':
          console.log('[Background] Processing GET_RESUME_INFO');
          const resumeInfo = await chrome.storage.local.get(['canResume', 'lastScrapedPage', 'lastScrapedUrl']);
          sendResponse(resumeInfo);
          break;

        case 'SCRAPED_IDS':
          console.log('[Background] Processing SCRAPED_IDS');
          await handleScrapedIDs(message.ids, message.hasResults, message.url);
          sendResponse({ success: true });
          break;

        case 'SCRAPING_COMPLETE':
          console.log('[Background] Processing SCRAPING_COMPLETE');
          await stopScraping(true); // Clear resume data when scraping completes
          sendResponse({ success: true });
          break;

        case 'EXPORT_PROFILES':
          console.log('[Background] Processing EXPORT_PROFILES');
          const profilesList = await exportProfiles();
          sendResponse({ profiles: profilesList });
          break;

        case 'CLEAR_DATABASE':
          console.log('[Background] Processing CLEAR_DATABASE');
          await clearDatabase();
          sendResponse({ success: true });
          break;

        case 'UPDATE_STATS':
          // Just an update notification, ignore
          break;

        default:
          console.warn('[Background] Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Background] Error handling message:', error);
      console.error('[Background] Error stack:', error.stack);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

// Initialize on extension load
(async () => {
  console.log('[Background] Background service worker loaded');
  console.log('[Background] API URL:', API_URL);

  // Test API connection
  try {
    const health = await fetch(`http://localhost:4000/`);
    const data = await health.json();
    console.log('[Background] ✓ API server connected:', data.message);
  } catch (error) {
    console.warn('[Background] ⚠ API server not reachable - using local storage fallback');
    console.warn('[Background] Start API with: npm run api');
  }

  await updateStats();
})();

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
