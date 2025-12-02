// Get DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const profileCountEl = document.getElementById('profileCount');
const pageCountEl = document.getElementById('pageCount');
const spinnerEl = document.getElementById('spinner');

// Update UI based on scraping state
async function updateUI() {
  const { isScrapingActive, profileCount = 0, pageCount = 0 } = await chrome.storage.local.get([
    'isScrapingActive',
    'profileCount',
    'pageCount'
  ]);

  profileCountEl.textContent = profileCount;
  pageCountEl.textContent = pageCount;

  if (isScrapingActive) {
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    spinnerEl.classList.remove('hidden');
    statusEl.textContent = `Scraping page ${pageCount}...`;
  } else {
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    spinnerEl.classList.add('hidden');
    statusEl.textContent = profileCount > 0 ? `Scraped ${profileCount} profiles` : 'Ready to scrape';
  }
}

// Start scraping
startBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.includes('collabstr.com/influencers')) {
    statusEl.textContent = 'Please navigate to Collabstr influencers page';
    return;
  }

  // Send start message to background
  chrome.runtime.sendMessage({ type: 'START_SCRAPING', tabId: tab.id });

  updateUI();
});

// Stop scraping
stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SCRAPING' });
  updateUI();
});

// Clear database
clearBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all scraped data?')) {
    statusEl.textContent = 'Clearing database...';

    await chrome.runtime.sendMessage({ type: 'CLEAR_DATABASE' });

    setTimeout(updateUI, 500);
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
