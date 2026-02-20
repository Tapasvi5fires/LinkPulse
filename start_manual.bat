@echo off
echo Starting LinkPulse in MANUAL mode (No Docker)...
echo.
echo IMPORTANT: 
echo 1. Ensure PostgreSQL is running on localhost:5432
echo 2. Ensure Redis is running on localhost:6379
echo 3. Ensure you have installed Python deps (in backend/) and Node deps (in frontend/)
echo.
pause

echo Starting Backend (in new window)...
start "LinkPulse Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload --env-file ../.env"

echo Starting Frontend (in new window)...
start "LinkPulse Frontend" cmd /k "cd frontend && npm run dev -- -p 3090"

echo.
echo Services started!
echo Backend: http://localhost:8090/docs
echo Frontend: http://localhost:3090
echo.
