// Content script for scraping individual profile pages
// Runs on collabstr.com/{username} pages

console.log('[Profile Scraper] Profile content script loaded on:', window.location.href);

// Extract profile ID from URL
function getProfileIdFromUrl() {
  const path = window.location.pathname;
  // Extract username from path (e.g., /abbieblanks)
  const match = path.match(/^\/([^\/\?]+)/);
  return match ? match[1] : null;
}

// Parse follower count to number (e.g., "29.8k Followers" → 29800)
function parseFollowerCount(text) {
  if (!text || text === 'View') return null;

  // Remove "Followers", "Subscribers", etc.
  let cleaned = text.replace(/\s*(Followers|Subscribers|Views?)\s*/gi, '').trim();

  // Handle k (thousands) and M (millions)
  if (cleaned.endsWith('k') || cleaned.endsWith('K')) {
    return parseInt(parseFloat(cleaned) * 1000, 10);
  } else if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    return parseInt(parseFloat(cleaned) * 1000000, 10);
  }

  // Try to parse as regular number
  const num = parseFloat(cleaned.replace(/,/g, ''));
  return isNaN(num) ? null : parseInt(num, 10);
}

// Extract profile details
function extractProfileDetails() {
  console.log('[Profile Scraper] Extracting profile details...');

  const details = {
    id: getProfileIdFromUrl(),
    name: null,
    location: null,
    bio: null,
    review_rating: null,
    review_count: null,
    social_platforms: []
  };

  // Extract name
  const nameEl = document.querySelector('.profile-name-desktop');
  if (nameEl) {
    details.name = nameEl.textContent.trim();
  } else {
    // Fallback: try h1.listing-title
    const titleEl = document.querySelector('h1.listing-title .profile-name-desktop');
    if (titleEl) {
      details.name = titleEl.textContent.trim();
    }
  }

  // Extract location from profile-name-location
  const locationEl = document.querySelector('.profile-name-location');
  if (locationEl) {
    let locationText = locationEl.textContent.trim();
    // Remove the mobile name part (e.g., "Abbie Blanks |")
    locationText = locationText.replace(/.*?\|/, '').trim();
    details.location = locationText;
  }

  // Extract bio
  const bioEl = document.querySelector('.listing-description');
  if (bioEl) {
    details.bio = bioEl.textContent.trim();
  }

  // Extract reviews (rating and count)
  const reviewEl = document.querySelector('.section-title.top-review-desktop, .section-title.top-review-mobile');
  if (reviewEl) {
    const reviewText = reviewEl.textContent.trim();
    // Format: "5.0 · 3 Reviews" or "5.0·3 Reviews"
    const ratingMatch = reviewText.match(/([\d\.]+)/);
    const countMatch = reviewText.match(/(\d+)\s*Review/i);

    if (ratingMatch) {
      details.review_rating = parseFloat(ratingMatch[1]);
    }
    if (countMatch) {
      details.review_count = parseInt(countMatch[1]);
    }
  }

  // Extract social media platforms
  const platformContainers = document.querySelectorAll('.platform-img-holder.platform-img-holder-creator .platform-img');

  platformContainers.forEach(container => {
    const link = container.querySelector('a');
    if (!link) return;

    const href = link.getAttribute('href');
    const platform = link.getAttribute('data-platform');
    const followerText = link.textContent.trim();

    // Determine platform type from image src if data-platform is not available
    let platformType = platform;
    if (!platformType) {
      const img = container.querySelector('img');
      if (img && img.src) {
        if (img.src.includes('instagram')) platformType = 'instagram';
        else if (img.src.includes('tiktok')) platformType = 'tiktok';
        else if (img.src.includes('youtube')) platformType = 'youtube';
        else if (img.src.includes('twitter')) platformType = 'twitter';
        else if (img.src.includes('twitch')) platformType = 'twitch';
        else if (img.src.includes('amazon')) platformType = 'amazon';
      }
    }

    // Parse followers to number
    const followers = parseFollowerCount(followerText);

    details.social_platforms.push({
      platform: platformType,
      link: href,
      followers: followers
    });
  });

  console.log('[Profile Scraper] Extracted details:', details);
  return details;
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Profile Scraper] Received message:', message.type);

  if (message.type === 'SCRAPE_PROFILE') {
    console.log('[Profile Scraper] Starting profile scrape...');

    // Wait a moment for page to fully load
    setTimeout(() => {
      try {
        const details = extractProfileDetails();

        // Check if this is a valid profile page
        if (!details.name) {
          console.warn('[Profile Scraper] Could not extract name - profile might not exist or page not loaded');

          // Check if we got a 404 or error page
          const errorIndicators = [
            document.title.toLowerCase().includes('not found'),
            document.title.toLowerCase().includes('404'),
            document.body.textContent.includes('Page not found'),
            document.body.textContent.includes("doesn't exist")
          ];

          if (errorIndicators.some(indicator => indicator)) {
            console.log('[Profile Scraper] This profile does not exist (404)');
            sendResponse({
              success: false,
              error: 'Profile does not exist (404)',
              shouldMarkFailed: true
            });
          } else {
            console.warn('[Profile Scraper] Profile page not fully loaded or invalid structure');
            sendResponse({
              success: false,
              error: 'Profile not fully loaded or invalid page',
              shouldMarkFailed: false // Might be network issue, retry later
            });
          }
          return;
        }

        // Validate that we have at least some meaningful data
        if (!details.location && !details.bio && details.social_platforms.length === 0) {
          console.warn('[Profile Scraper] Profile has name but no other data - might be invalid');
          sendResponse({
            success: false,
            error: 'Profile has insufficient data',
            shouldMarkFailed: true
          });
          return;
        }

        console.log('[Profile Scraper] Successfully extracted profile data');
        sendResponse({
          success: true,
          details: details
        });
      } catch (error) {
        console.error('[Profile Scraper] Error extracting profile:', error);
        sendResponse({
          success: false,
          error: error.message,
          shouldMarkFailed: false
        });
      }
    }, 2000); // Wait 2 seconds for page load

    return true; // Keep channel open for async response
  }

  return false;
});

// Auto-detect if we're on a profile page and notify background
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Profile Scraper] DOM loaded on profile page');
  });
} else {
  console.log('[Profile Scraper] DOM already loaded on profile page');
}
