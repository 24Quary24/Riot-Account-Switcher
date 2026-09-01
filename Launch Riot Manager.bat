@echo off
title Riot Account Switcher
cd /d "%~dp0"

REM Check if release .exe exists
if exist "release\win-unpacked\Riot Account Switcher.exe" (
    start "" "release\win-unpacked\Riot Account Switcher.exe"
    exit /b
)

REM Check if portable .exe exists
for %%f in ("release\*.exe") do (
    start "" "%%f"
    exit /b
)

REM Fallback to running built electron app
start "" npx electron .
exit /b
