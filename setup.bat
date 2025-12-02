@echo off
echo ========================================
echo Collabstr Scraper Extension Setup
echo ========================================
echo.

echo Checking for npm...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm not found!
    echo Please install Node.js from: https://nodejs.org/
    echo.
    echo Or download sql.js manually from:
    echo https://github.com/sql-js/sql.js/releases/latest
    pause
    exit /b 1
)

echo Found npm!
echo.
echo Installing dependencies...
echo.

call npm install

if %ERRORLEVEL% NEQ 0 (
    echo Error: npm install failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Create icon images (icon16.png, icon48.png, icon128.png)
echo    Open generate-icons.html in your browser
echo 2. Open Chrome and go to chrome://extensions/
echo 3. Enable Developer mode
echo 4. Click "Load unpacked" and select this folder
echo.
echo Press any key to exit...
pause >nul
