@echo off
rem Publishes this V2 folder to the live game (angler.homeprojecthub.co.za):
rem runs the tests, pushes to GitHub, updates the server and restarts it.
rem The server asks for its password once (for the restart).
cd /d "%~dp0"
set "GITBASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%GITBASH%" (echo Git for Windows is needed: https://git-scm.com & pause & exit /b 1)
"%GITBASH%" tools/deploy-v2.sh
echo.
pause
