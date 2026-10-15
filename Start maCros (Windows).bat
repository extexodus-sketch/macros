@echo off
REM Double-click to open maCros on Windows. Keep this window open while you use the app.
cd /d "%~dp0"
set PORT=8760
echo maCros running at http://localhost:%PORT%  (close this window to stop)
start "" http://localhost:%PORT%
where py >nul 2>nul && (py -m http.server %PORT% --bind 127.0.0.1) || (python -m http.server %PORT% --bind 127.0.0.1)
