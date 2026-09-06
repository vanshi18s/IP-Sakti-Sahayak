@echo off
REM Start backend + frontend on Windows. Close the two windows to stop.
cd /d "%~dp0"

if not exist backend\.env (
  echo backend\.env missing. Copy backend\.env.example to backend\.env and add your keys.
  pause
  exit /b 1
)

start "IP-SAKTI backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --port 8000"
start "IP-SAKTI frontend" cmd /k "cd frontend && npm run dev"
echo.
echo Two windows opened. Wait ~20 seconds, then open http://localhost:5173
pause
