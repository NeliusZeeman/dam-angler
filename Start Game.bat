@echo off
title Pond Fishing - game server
cd /d "%~dp0"

rem The game is a browser game: it needs a small local web server, then the
rem browser pointed at it. Node.js provides the server (npx serve).
where npx >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed, so the game server can't start.
  echo  Install it from https://nodejs.org ^(LTS version^), then run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting Pond Fishing...
echo  The game opens in your browser in a few seconds.
echo  Keep this window open while you play -- close it to stop the game.
echo.

rem Stamp the current version so browsers always load the latest files.
node tools\stamp-version.mjs

rem Open the browser once the server has had a moment to start.
start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:5173"

npx -y serve -l 5173 .

echo.
echo  The game server stopped. If it said the port is in use, the game is
echo  probably already running -- just open http://localhost:5173
echo.
pause
