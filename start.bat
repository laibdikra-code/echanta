@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Installation des dependances...
  call npm install --omit=dev
)
start "" http://localhost:3000
node server.js
pause
