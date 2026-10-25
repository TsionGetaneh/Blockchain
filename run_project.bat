@echo off
echo =======================================================
echo   Starting CryptoCurrency Spam Detection Platform
echo =======================================================
echo.

echo [1/4] Starting Postgres (Port 5433) and Redis (Port 6379)...
cd /d "%~dp0backend"
docker-compose up -d

echo.
echo [2/4] Starting Blockchain Engine API (Port 8055)...
start "Blockchain Engine API" cmd /k "cd /d "%~dp0Blockchain" && .venv\Scripts\activate && python -m blockchain_engine.scripts.run_api_server --host 127.0.0.1 --port 8055"

echo.
echo [3/4] Starting NestJS Backend API (Port 3000)...
start "NestJS Backend API" cmd /k "cd /d "%~dp0backend" && npm run start:dev"

echo.
echo [4/4] Starting Next.js Frontend Dashboard...
start "Next.js Dashboard" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo =======================================================
echo   All 3 Crypto Spam Detection services are launching!
echo   - Blockchain Engine: http://127.0.0.1:8055
echo   - Backend API:       http://localhost:3000
echo   - Swagger Docs:      http://localhost:3000/api/docs
echo   - Frontend:          http://localhost:5173
echo =======================================================
