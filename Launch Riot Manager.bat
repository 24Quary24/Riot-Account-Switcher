@echo off
title Riot Account Switcher
cd /d "%~dp0"

REM 1. Check if root portable .exe exists directly in this directory
if exist "%~dp0Riot Account Switcher.exe" (
    start "" "%~dp0Riot Account Switcher.exe"
    exit /b
)

REM 2. Check if release unpacked .exe exists
if exist "%~dp0release\win-unpacked\Riot Account Switcher.exe" (
    start "" "%~dp0release\win-unpacked\Riot Account Switcher.exe"
    exit /b
)

REM 3. Check if release portable .exe exists
for %%f in ("%~dp0release\*.exe") do (
    start "" "%%f"
    exit /b
)

REM 4. Fallback: Run built Electron app via Node.js
where npx >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "" npx electron .
    exit /b
)

echo [ERROR] Riot Account Switcher executable or Node.js environment not found.
echo Please run "npm run dist" to build the executable, or install Node.js.
pause
exit /b

