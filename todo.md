Chrome Extension Plan (Scrape Collabstr Influencer IDs → SQLite → Auto-paginate)
What the extension must do

Open the URL you provided (with filters applied manually):
https://collabstr.com/influencers?ph_id=622942&p=instagram

You manually select filters → the URL changes automatically.

The extension will:

Read all profile IDs on the page (from the <a> links of each profile card).

Store them in a local SQLite database inside the extension.

Click Next Page → load page 2.

Repeat until no more pages.

Prevent duplicates.

🧠 How to Extract Profile IDs

On each card, the profile link looks like:

<a class="profile-listing-link" href="/adilmalnick?ph_id=622942&p=instagram">


So the profile ID is the username inside the href:

/adilmalnick

/derekpinder

/amandajordan

etc.

You extract it simply by:

const id = link.href.split("collabstr.com/")[1].split("?")[0];

🗄️ SQLite in a Chrome Extension

Use sql.js, a WASM version of SQLite that works inside browser extensions.

Store DB in chrome.storage.local or in IndexedDB.

🚀 Extension Architecture
manifest.json

Action: popup or always-running background worker

Permissions:

"scripting", "activeTab", "storage"

Content script injected on:
"https://collabstr.com/influencers*"

Components

content.js
Runs inside the page, extracts profile IDs, and sends results to background.

background.js
Holds SQLite DB, saves records, and triggers navigation to next page.

popup.html / popup.js
Button: "Start Scraping".

🧩 Complete Logic Flow
1. User opens URL manually

Example:
https://collabstr.com/influencers?ph_id=622942&p=instagram

You select filters.

2. Click “Start Scraping” in extension

The extension:

Detects current URL.

Extracts ph_id, p, and page number if any.

Sends content script to scrape.

🧩 3. content script extracts profile IDs
content.js
(() => {
const elements = document.querySelectorAll('a.profile-listing-link');
const ids = [...elements].map(el => {
const h = el.href;
return h.split("collabstr.com/")[1].split("?")[0];
});

chrome.runtime.sendMessage({
type: "SCRAPED_IDS",
ids
});
})();

🧩 4. background.js stores in SQLite and goes next page

Pseudocode:

async function handleScrapedIDs(ids) {
for (const id of ids) {
await db.run("INSERT OR IGNORE INTO profiles (id) VALUES (?)", [id]);
}

const nextPageUrl = incrementPageNumber(currentUrl);

if (nextPageUrl) {
chrome.tabs.update(tabId, { url: nextPageUrl });
} else {
console.log("== All pages scraped ==");
}
}


Page is incremented by:

function incrementPageNumber(url) {
const u = new URL(url);
const current = Number(u.searchParams.get("pg") || 1);

// check if next page contains results? we just try
u.searchParams.set("pg", current + 1);
return u.toString();
}

🧩 5. Continue until empty page

When the page loads but contains 0 influencer cards, stop.

In content script:

if (document.querySelectorAll('a.profile-listing-link').length === 0) {
chrome.runtime.sendMessage({ type: "NO_MORE_PAGES" });
}

✔️ Final Output: SQLite DB

Table: profiles

Column: id TEXT PRIMARY KEY

You will end up with a deduplicated list of all scraped influencer IDs for the filtered search.