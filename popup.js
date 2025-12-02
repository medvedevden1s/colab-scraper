// Get DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const resumeBtn = document.getElementById('resumeBtn');
const statusEl = document.getElementById('status');
const profileCountEl = document.getElementById('profileCount');
const pageCountEl = document.getElementById('pageCount');
const spinnerEl = document.getElementById('spinner');
const resumeInfoEl = document.getElementById('resumeInfo');
const resumePageEl = document.getElementById('resumePage');
const waitTimeInput = document.getElementById('waitTime');

// Update UI based on scraping state
async function updateUI() {
  const { isScrapingActive, profileCount = 0, pageCount = 0, waitTime = 3 } = await chrome.storage.local.get([
    'isScrapingActive',
    'profileCount',
    'pageCount',
    'waitTime'
  ]);

  // Check for resume info
  const resumeInfo = await chrome.runtime.sendMessage({ type: 'GET_RESUME_INFO' });

  profileCountEl.textContent = profileCount;
  pageCountEl.textContent = pageCount;
  waitTimeInput.value = waitTime;

  if (isScrapingActive) {
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    spinnerEl.classList.remove('hidden');
    resumeInfoEl.classList.add('hidden');
    statusEl.textContent = `Scraping page ${pageCount}...`;
  } else {
    stopBtn.classList.add('hidden');
    spinnerEl.classList.add('hidden');

    // Show resume button if available
    if (resumeInfo && resumeInfo.canResume && resumeInfo.lastScrapedPage) {
      resumeInfoEl.classList.remove('hidden');
      resumePageEl.textContent = resumeInfo.lastScrapedPage;
      startBtn.classList.add('hidden');
    } else {
      resumeInfoEl.classList.add('hidden');
      startBtn.classList.remove('hidden');
    }

    statusEl.textContent = profileCount > 0 ? `Scraped ${profileCount} profiles` : 'Ready to scrape';
  }
}

// Start scraping (fresh start, clears resume data)
startBtn.addEventListener('click', async () => {
  console.log('[Popup] Start button clicked');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[Popup] Current tab:', tab.id, tab.url);

  if (!tab.url || !tab.url.includes('collabstr.com/influencers')) {
    console.warn('[Popup] Not on Collabstr influencers page');
    statusEl.textContent = 'Please navigate to Collabstr influencers page';
    return;
  }

  // Clear resume data when starting fresh
  await chrome.storage.local.set({
    canResume: false,
    lastScrapedPage: null,
    lastScrapedUrl: null
  });

  console.log('[Popup] Sending START_SCRAPING message to background');
  statusEl.textContent = 'Starting scraper...';

  try {
    // Send start message to background
    const response = await chrome.runtime.sendMessage({ type: 'START_SCRAPING', tabId: tab.id });
    console.log('[Popup] Background response:', response);

    if (response && response.success) {
      console.log('[Popup] Scraping started successfully');
    } else {
      console.error('[Popup] Failed to start scraping:', response);
      statusEl.textContent = 'Error starting scraper';
    }
  } catch (error) {
    console.error('[Popup] Error sending message:', error);
    statusEl.textContent = 'Error: ' + error.message;
  }

  await updateUI();
});

// Resume scraping from last page
resumeBtn.addEventListener('click', async () => {
  console.log('[Popup] Resume button clicked');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[Popup] Current tab:', tab.id, tab.url);

  statusEl.textContent = 'Resuming scraper...';

  try {
    // Send resume message to background
    const response = await chrome.runtime.sendMessage({ type: 'RESUME_SCRAPING', tabId: tab.id });
    console.log('[Popup] Background response:', response);

    if (response && response.success) {
      console.log('[Popup] Scraping resumed successfully');
    } else {
      console.error('[Popup] Failed to resume scraping:', response);
      statusEl.textContent = 'Error resuming scraper';
    }
  } catch (error) {
    console.error('[Popup] Error sending message:', error);
    statusEl.textContent = 'Error: ' + error.message;
  }

  await updateUI();
});

// Stop scraping
stopBtn.addEventListener('click', () => {
  console.log('[Popup] Stop button clicked');
  chrome.runtime.sendMessage({ type: 'STOP_SCRAPING' });
  updateUI();
});

// Export profiles
exportBtn.addEventListener('click', async () => {
  console.log('[Popup] Export button clicked');
  statusEl.textContent = 'Exporting...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'EXPORT_PROFILES' });
    console.log('[Popup] Export response:', response);

    if (response.profiles && response.profiles.length > 0) {
      // Create CSV
      let csv = 'id,page,scraped_at\n';
      response.profiles.forEach(profile => {
        csv += `${profile.id},${profile.page},${profile.scraped_at}\n`;
      });

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collabstr-profiles-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      statusEl.textContent = `Exported ${response.profiles.length} profiles`;
      console.log('[Popup] Exported', response.profiles.length, 'profiles');
    } else {
      statusEl.textContent = 'No profiles to export';
      console.log('[Popup] No profiles found');
    }
  } catch (error) {
    console.error('[Popup] Export error:', error);
    statusEl.textContent = 'Export failed';
  }

  setTimeout(updateUI, 2000);
});

// Clear database
clearBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all scraped data?')) {
    statusEl.textContent = 'Clearing database...';

    await chrome.runtime.sendMessage({ type: 'CLEAR_DATABASE' });

    setTimeout(updateUI, 500);
  }
});

// Save wait time setting when changed
waitTimeInput.addEventListener('change', async () => {
  const waitTime = parseInt(waitTimeInput.value);
  if (waitTime >= 1 && waitTime <= 10) {
    await chrome.storage.local.set({ waitTime });
    console.log('[Popup] Wait time updated to', waitTime, 'seconds');
  }
});

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_STATS') {
    updateUI();
  }
});

// Initialize UI on load
updateUI();

// Update UI every 2 seconds while open
setInterval(updateUI, 2000);
