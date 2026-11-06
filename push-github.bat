@echo off
rem ============================================================
rem  One-click push to GitHub (english-vocabulary repo)
rem  Bypasses local proxy (which fails on github.com) and
rem  force-pushes local content over the old repo (high-school
rem  version replaces the old junior-high version).
rem ============================================================
setlocal
set "GIT=C:/Users/1/AppData/Local/Programs/WorkBuddy/resources/vendor/PortableGit/cmd/git.exe"

set "HTTP_PROXY="
set "HTTPS_PROXY="
set "http_proxy="
set "https_proxy="

cd /d "%~dp0"

echo ============================================
echo  Pushing to GitHub (direct, no proxy)...
echo ============================================

"%GIT%" -c http.proxy= -c https.proxy= push --force-with-lease -u origin main 2^>^&1

echo.
if errorlevel 1 (
  echo.
  echo  [FAIL] Push failed. GitHub may be unreachable.
  echo  Tip: GitHub main site is flaky from China. Retry later.
) else (
  echo.
  echo  [OK] Pushed. Enable Pages in repo Settings.
  echo  Phone URL: https://x13502239474-oss.github.io/english-vocabulary/
)

echo.
pause
endlocal
