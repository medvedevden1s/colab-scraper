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

// Profile scraping elements
const startProfileBtn = document.getElementById('startProfileBtn');
const stopProfileBtn = document.getElementById('stopProfileBtn');
const profileScrapedEl = document.getElementById('profileScraped');
const profileRemainingEl = document.getElementById('profileRemaining');
const profilePercentageEl = document.getElementById('profilePercentage');
const parallelTabsInput = document.getElementById('parallelTabs');

// Update UI based on scraping state
async function updateUI() {
  const {
    isScrapingActive,
    profileCount = 0,
    pageCount = 0,
    waitTime = 3,
    isProfileScrapingActive = false,
    profileProgress = { scraped: 0, idOnly: 0, percentage: 0 },
    parallelTabs = 2
  } = await chrome.storage.local.get([
    'isScrapingActive',
    'profileCount',
    'pageCount',
    'waitTime',
    'isProfileScrapingActive',
    'profileProgress',
    'parallelTabs'
  ]);

  // Check for resume info
  const resumeInfo = await chrome.runtime.sendMessage({ type: 'GET_RESUME_INFO' });

  profileCountEl.textContent = profileCount;
  pageCountEl.textContent = pageCount;
  waitTimeInput.value = waitTime;
  parallelTabsInput.value = parallelTabs;

  // Update list scraping UI
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

  // Update profile scraping UI
  profileScrapedEl.textContent = profileProgress.scraped;
  profileRemainingEl.textContent = profileProgress.idOnly;
  profilePercentageEl.textContent = `${profileProgress.percentage}% Complete`;

  if (isProfileScrapingActive) {
    startProfileBtn.classList.add('hidden');
    stopProfileBtn.classList.remove('hidden');
  } else {
    startProfileBtn.classList.remove('hidden');
    stopProfileBtn.classList.add('hidden');
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

// Save parallel tabs setting when changed
parallelTabsInput.addEventListener('change', async () => {
  const parallelTabs = parseInt(parallelTabsInput.value);
  if (parallelTabs >= 1 && parallelTabs <= 20) {
    await chrome.storage.local.set({ parallelTabs });
    console.log('[Popup] Parallel tabs updated to', parallelTabs);
  } else {
    console.warn('[Popup] Invalid parallel tabs value:', parallelTabs);
  }
});

// Start profile scraping
startProfileBtn.addEventListener('click', async () => {
  console.log('[Popup] Start Profile Scraping button clicked');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'START_PROFILE_SCRAPING' });
    console.log('[Popup] Profile scraping response:', response);

    if (response && response.success) {
      console.log('[Popup] Profile scraping started successfully');
    } else {
      console.error('[Popup] Failed to start profile scraping:', response);
    }
  } catch (error) {
    console.error('[Popup] Error starting profile scraping:', error);
  }

  await updateUI();
});

// Stop profile scraping
stopProfileBtn.addEventListener('click', async () => {
  console.log('[Popup] Stop Profile Scraping button clicked');

  try {
    await chrome.runtime.sendMessage({ type: 'STOP_PROFILE_SCRAPING' });
    console.log('[Popup] Profile scraping stopped');
  } catch (error) {
    console.error('[Popup] Error stopping profile scraping:', error);
  }

  await updateUI();
});

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_STATS' || message.type === 'UPDATE_PROFILE_PROGRESS') {
    updateUI();
  }
});

// Initialize UI on load
updateUI();

// Update UI every 2 seconds while open
setInterval(updateUI, 2000);
