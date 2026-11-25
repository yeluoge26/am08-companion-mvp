@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:4180 in your browser.
if exist .env (node --env-file=.env server.mjs) else (node server.mjs)
pause
