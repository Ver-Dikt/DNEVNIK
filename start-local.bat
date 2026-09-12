@echo off
setlocal

cd /d "%~dp0"

echo.
echo Starting DNEVNIK locally in clean preview mode...
echo Project: %CD%
echo.

if not exist "node_modules" (
  echo node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Building local preview...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Open this link in your browser:
echo http://127.0.0.1:3000
echo.
echo Press Ctrl+C in this window to stop the local server.
echo.

call npm run start -- --hostname 127.0.0.1 --port 3000

pause
