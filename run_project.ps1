# PowerShell Launcher for CryptoCurrency Spam Detection Platform
$root = $PSScriptRoot

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Starting CryptoCurrency Spam Detection Platform" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Databases
Write-Host "`n[1/4] Starting PostgreSQL & Redis via Docker..." -ForegroundColor Yellow
Set-Location "$root\backend"
docker-compose up -d

# 2. Blockchain Engine
Write-Host "[2/4] Starting Blockchain Engine API (Port 8055)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\Blockchain'; .\.venv\Scripts\activate; python -m blockchain_engine.scripts.run_api_server --host 127.0.0.1 --port 8055"

# 3. NestJS Backend
Write-Host "[3/4] Starting NestJS Backend (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run start:dev"

# 4. Next.js Frontend
Write-Host "[4/4] Starting Next.js Analyst Dashboard..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  All services launched in separate windows!" -ForegroundColor Green
Write-Host "  - Blockchain Engine: http://127.0.0.1:8055" -ForegroundColor Green
Write-Host "  - Backend API:       http://localhost:3000" -ForegroundColor Green
Write-Host "  - Swagger API Docs:  http://localhost:3000/api/docs" -ForegroundColor Green
Write-Host "  - Frontend:          http://localhost:5173" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
