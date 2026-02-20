@echo off
echo Starting Infrastructure (Postgres ^& Redis) via Docker...
echo.

docker-compose up -d db redis

echo.
echo Waiting for services to initialize...
timeout /t 5

echo.
echo Infrastructure is running!
echo Now you can run: start_manual.bat
echo.
pause
