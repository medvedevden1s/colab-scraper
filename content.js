// Content script that runs on Collabstr influencers pages
// Extracts profile IDs and sends them to background script

// Function to extract profile IDs from the current page
function extractProfileIDs() {
  const elements = document.querySelectorAll('a.profile-listing-link');

  if (elements.length === 0) {
    return [];
  }

  const ids = [...elements].map(el => {
    const href = el.href;
    // Extract the username from the URL
    // Example: https://collabstr.com/adilmalnick?ph_id=622942&p=instagram
    // We want: adilmalnick
    const parts = href.split("collabstr.com/")[1];
    if (parts) {
      return parts.split("?")[0];
    }
    return null;
  }).filter(id => id !== null && id !== '');

  return ids;
}

// Listen for scrape requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_PAGE') {
    // Extract IDs
    const ids = extractProfileIDs();

    // Send results back
    sendResponse({
      ids: ids,
      hasResults: ids.length > 0,
      url: window.location.href
    });
  }
});

// Auto-scrape when extension is active
// Listen for signal from background that scraping is active
let isScrapingActive = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPING_STARTED') {
    isScrapingActive = true;
    // Wait for page to load, then scrape
    setTimeout(() => {
      if (isScrapingActive) {
        performScrape();
      }
    }, 1000);
  }

  if (message.type === 'SCRAPING_STOPPED') {
    isScrapingActive = false;
  }
});

// Perform scraping and send results
function performScrape() {
  const ids = extractProfileIDs();

  chrome.runtime.sendMessage({
    type: 'SCRAPED_IDS',
    ids: ids,
    hasResults: ids.length > 0,
    url: window.location.href
  });
}

// Also check when DOM changes (in case page loads dynamically)
let observer = null;

function startObserving() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    // Check if profile listings have been added
    const hasProfileListings = document.querySelectorAll('a.profile-listing-link').length > 0;

    if (hasProfileListings && isScrapingActive) {
      observer.disconnect();
      setTimeout(performScrape, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start observing on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}
