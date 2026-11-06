@echo off
rem High-school vocabulary app - local server mode.
rem Microphone shadowing needs http; other features work by opening index.html directly.
cd /d "%~dp0"
start "" cmd /c "timeout /t 1 >nul & start http://localhost:8000"
python -m http.server 8000
