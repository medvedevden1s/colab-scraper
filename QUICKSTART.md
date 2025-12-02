# Quick Start Guide

Get your Collabstr scraper running in 5 minutes!

## Step 1: Install Dependencies

Simple one-command setup:

```bash
cd Pluign
npm install
```

This automatically installs sql.js and copies all required files!

**Alternative methods:**
- Windows: Run `setup.bat`
- Mac/Linux: Run `./setup.sh`
- Manual: Download from https://github.com/sql-js/sql.js/releases/latest

## Step 2: Generate Icons

Open `generate-icons.html` in your browser and click "Download All Icons"

**OR** Use your own icons (16x16, 48x48, 128x128 PNG files)

## Step 3: Load Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `Pluign` folder
5. Done!

## Step 4: Start Scraping

1. Go to: https://collabstr.com/influencers?ph_id=622942&p=instagram
2. Apply your filters (platform, niche, followers, etc.)
3. Click the extension icon
4. Click **Start Scraping**
5. Watch it collect all profiles automatically!

## Common Issues

**Extension won't load?**
- Make sure `sql.js` and `sql-wasm.wasm` are in the folder
- Check all icons are present

**Scraping won't start?**
- Verify you're on a Collabstr influencers page
- URL must contain `/influencers`

**Need help?**
- See README.md for detailed documentation
- Check Chrome DevTools Console for errors

## Features

- **Auto-pagination**: Scrapes all pages automatically
- **No duplicates**: SQLite ensures unique profiles per page
- **Complete data**: Saves ID, page number, and timestamp
- **Real-time stats**: See progress live
- **Persistent**: Data saved immediately to database

Happy scraping!
