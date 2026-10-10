@echo off
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
echo Opening NIVAL at http://127.0.0.1:5173/
call npm run dev
