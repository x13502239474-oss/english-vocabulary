@echo off
setlocal
cd /d "%~dp0"
set "PORT=8000"

echo ============================================================
echo   Vocabulary Trainer - local server
echo ============================================================
echo.

rem --- find python: try "python" first, then the "py" launcher ---
set "PYCMD="
where python >nul 2>nul
if %errorlevel% equ 0 set "PYCMD=python"
if defined PYCMD goto run

where py >nul 2>nul
if %errorlevel% equ 0 set "PYCMD=py"
if defined PYCMD goto run

echo [ERROR] Python not found on this computer.
echo         Install it from https://www.python.org/downloads/
echo         and tick "Add Python to PATH" during setup.
echo.
pause
exit /b 1

:run
echo Starting server on port %PORT% ...
echo.
echo   Open in browser :  http://localhost:%PORT%
echo   Stop server     :  press Ctrl+C here, or just close this window
echo.
echo   Keep this window OPEN while you study, otherwise the page
echo   will stop loading.
echo.
echo   Note: the speaking test needs this localhost address.
echo   Opening index.html by double-click has no microphone access.
echo.

if not "%NOBROWSER%"=="1" start "" "http://localhost:%PORT%"

%PYCMD% -m http.server %PORT%

echo.
echo Server stopped.
pause
