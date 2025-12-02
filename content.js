// Content script that runs on Collabstr influencers pages
// Extracts profile IDs and sends them to background script

console.log('[Collabstr Scraper] Content script loaded on:', window.location.href);

// Function to extract profile IDs from the current page
function extractProfileIDs() {
  // Updated selector: find <a> tags inside .profile-listing-holder divs
  const elements = document.querySelectorAll('.profile-listing-holder a[href^="/"]');
  console.log('[Collabstr Scraper] Found', elements.length, 'profile links');

  if (elements.length === 0) {
    console.warn('[Collabstr Scraper] No profile links found. Checking page structure...');
    // Log what we can find to help debug
    const holders = document.querySelectorAll('.profile-listing-holder');
    console.log('[Collabstr Scraper] Profile holders found:', holders.length);
    const allLinks = document.querySelectorAll('a[href^="/"]');
    console.log('[Collabstr Scraper] Total links starting with /:', allLinks.length);
    if (allLinks.length > 0) {
      console.log('[Collabstr Scraper] Sample link:', allLinks[0].href, 'classes:', allLinks[0].className);
    }
    return [];
  }

  const ids = [...elements].map(el => {
    const href = el.getAttribute('href');
    // Extract the username from the URL
    // Example: /hammyandbrody?p=instagram
    // We want: hammyandbrody
    if (href && href.startsWith('/')) {
      const parts = href.substring(1); // Remove leading /
      const username = parts.split('?')[0];
      return username;
    }
    return null;
  }).filter(id => {
    if (!id || id === '') return false;

    // Filter out common non-profile paths
    const excludePaths = [
      'influencers',
      'brands',
      'login',
      'signup',
      'search',
      'how-it-works',
      'pricing',
      'about',
      'contact',
      'terms',
      'privacy',
      'faq'
    ];

    if (excludePaths.includes(id.toLowerCase())) return false;

    // Filter out IDs that start with numbers followed by nothing or dashes (likely navigation/filter links)
    // Keep IDs like "0124riii" but exclude "-10271", "123", etc.
    if (/^-?\d+$/.test(id)) return false; // Pure numbers or negative numbers

    // Filter out very short IDs (likely not usernames)
    if (id.length < 3) return false;

    // Keep everything else
    return true;
  });

  console.log('[Collabstr Scraper] Extracted profile IDs:', ids);
  return ids;
}

// Auto-scrape when extension is active
let isScrapingActive = false;

// Unified message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Collabstr Scraper] Received message:', message.type);

  if (message.type === 'SCRAPING_STARTED') {
    console.log('[Collabstr Scraper] Scraping started!');
    isScrapingActive = true;

    // Try to scrape immediately
    setTimeout(() => {
      if (isScrapingActive) {
        console.log('[Collabstr Scraper] Performing initial scrape...');
        performScrape();
      }
    }, 1000);

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SCRAPING_STOPPED') {
    console.log('[Collabstr Scraper] Scraping stopped');
    isScrapingActive = false;
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SCRAPE_PAGE') {
    console.log('[Collabstr Scraper] Manual scrape request');
    const ids = extractProfileIDs();
    sendResponse({
      ids: ids,
      hasResults: ids.length > 0,
      url: window.location.href
    });
    return true;
  }

  return false;
});

// Scroll page to load all content (lazy loading)
async function scrollToLoadAll() {
  console.log('[Collabstr Scraper] Scrolling page to load all content...');

  return new Promise((resolve) => {
    let lastHeight = document.body.scrollHeight;
    let scrollCount = 0;
    const maxScrolls = 10; // Safety limit

    const scrollInterval = setInterval(() => {
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      scrollCount++;

      console.log('[Collabstr Scraper] Scroll', scrollCount, '- Height:', document.body.scrollHeight);

      setTimeout(() => {
        const newHeight = document.body.scrollHeight;

        // Check if we've reached the bottom or hit max scrolls
        if (newHeight === lastHeight || scrollCount >= maxScrolls) {
          clearInterval(scrollInterval);
          console.log('[Collabstr Scraper] Finished scrolling. Total scrolls:', scrollCount);
          // Scroll back to top
          window.scrollTo(0, 0);
          resolve();
        }

        lastHeight = newHeight;
      }, 1000); // Wait 1 second after each scroll
    }, 1500); // Scroll every 1.5 seconds
  });
}

// Find and click the Next button
function clickNextButton() {
  console.log('[Collabstr Scraper] Looking for Next button...');

  // Find ALL pagination buttons
  const allButtons = document.querySelectorAll('.pagination-arrow-holder');
  console.log('[Collabstr Scraper] Found', allButtons.length, 'pagination buttons');

  // The Next button is typically the last one (Back is first, Next is last)
  // Also check if it contains "Next" in the text or has a higher page number
  let nextButton = null;

  for (const button of allButtons) {
    const text = button.textContent.toLowerCase();
    console.log('[Collabstr Scraper] Button text:', text, 'href:', button.href);

    // Look for "next" in the button text
    if (text.includes('next')) {
      nextButton = button;
      break;
    }
  }

  // If we didn't find a "next" button, try the last pagination button
  if (!nextButton && allButtons.length > 0) {
    // Get current page from URL
    const currentPage = parseInt(new URL(window.location.href).searchParams.get('pg')) || 1;

    // Check each button's href for a higher page number
    for (const button of allButtons) {
      const href = button.getAttribute('href');
      const match = href.match(/pg=(\d+)/);
      if (match) {
        const targetPage = parseInt(match[1]);
        if (targetPage > currentPage) {
          nextButton = button;
          break;
        }
      }
    }
  }

  if (nextButton) {
    console.log('[Collabstr Scraper] Found Next button:', nextButton.href);

    // Scroll to button to make sure it's visible
    nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait a moment, then click
    setTimeout(() => {
      console.log('[Collabstr Scraper] Clicking Next button...');
      nextButton.click();
    }, 1000);

    return true;
  } else {
    console.log('[Collabstr Scraper] No Next button found - might be last page');
    return false;
  }
}

// Perform scraping and send results
async function performScrape() {
  console.log('[Collabstr Scraper] Starting scrape...');

  // Get wait time from storage (default 3 seconds)
  const { waitTime = 3 } = await chrome.storage.local.get(['waitTime']);
  const waitMs = waitTime * 1000;

  // Wait for page to fully load
  console.log(`[Collabstr Scraper] Waiting ${waitTime} seconds for page to load...`);
  await new Promise(resolve => setTimeout(resolve, waitMs));

  // Scroll the page to load all lazy-loaded content
  await scrollToLoadAll();

  // Now extract all IDs
  const ids = extractProfileIDs();

  if (ids.length === 0) {
    console.warn('[Collabstr Scraper] No profiles found on page!');
  }

  console.log('[Collabstr Scraper] Sending', ids.length, 'profiles to background');

  chrome.runtime.sendMessage({
    type: 'SCRAPED_IDS',
    ids: ids,
    hasResults: ids.length > 0,
    url: window.location.href,
    clickNext: true  // Tell background we'll handle navigation via Next button
  }).then(async () => {
    console.log('[Collabstr Scraper] Message sent successfully');

    // If scraping is still active and we have results, click Next after a delay
    if (isScrapingActive && ids.length > 0) {
      // Get wait time from storage for consistency
      const { waitTime = 3 } = await chrome.storage.local.get(['waitTime']);
      console.log(`[Collabstr Scraper] Waiting ${waitTime} seconds before clicking Next...`);
      setTimeout(() => {
        if (isScrapingActive) {
          const hasNext = clickNextButton();
          if (!hasNext) {
            // No next button - we're done
            chrome.runtime.sendMessage({ type: 'SCRAPING_COMPLETE' });
          }
        }
      }, waitTime * 1000);
    }
  }).catch(err => {
    console.error('[Collabstr Scraper] Error sending message:', err);
  });
}

// Also check when DOM changes (in case page loads dynamically)
let observer = null;

function startObserving() {
  if (observer) {
    observer.disconnect();
  }

  console.log('[Collabstr Scraper] Starting DOM observer');

  observer = new MutationObserver((mutations) => {
    // Check if profile listings have been added
    const hasProfileListings = document.querySelectorAll('.profile-listing-holder a[href^="/"]').length > 0;

    if (hasProfileListings && isScrapingActive) {
      console.log('[Collabstr Scraper] Profile listings detected via observer');
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
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Collabstr Scraper] DOM loaded');
    startObserving();
  });
} else {
  console.log('[Collabstr Scraper] DOM already loaded');
  startObserving();
}

// Also log when we detect profiles on page load
setTimeout(() => {
  const count = document.querySelectorAll('.profile-listing-holder a[href^="/"]').length;
  console.log('[Collabstr Scraper] Initial check: found', count, 'profiles on page');
}, 2000);
