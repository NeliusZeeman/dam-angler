@echo off
rem Shrinks the fish pictures in assets\fish (PNG from ChatGPT) to small WebP
rem files so the catch card loads fast on phones. Run it after adding pictures.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is needed: https://nodejs.org & pause & exit /b 1)
node tools\optimize-fish-images.mjs
echo.
pause
