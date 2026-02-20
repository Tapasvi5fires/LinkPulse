@echo off
echo Starting LinkPulse AI Platform...
echo.

echo 1. Ensure Docker Desktop is running.
echo 2. Ensure you have set GEMINI_API_KEY in .env
echo.

echo Stopping any running containers...
docker-compose down

echo.
echo Building and starting services...
docker-compose up --build -d

echo.
echo ===================================================
echo   LinkPulse is initializing!
echo ===================================================
echo.
echo   - Backend API:    Check .env (Default: http://localhost:8090/docs)
echo   - Frontend App:   Check .env (Default: http://localhost:3090)
echo.
echo   To see logs, run: docker-compose logs -f
echo.
echo ===================================================
pause
