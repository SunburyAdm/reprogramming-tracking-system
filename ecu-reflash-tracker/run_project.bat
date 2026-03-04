@echo off
REM Script to run the ECU Reflash Tracker project locally without Docker on Windows
REM Assumes Python 3.11+, Node.js 18+ are installed

setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo ================================================
echo ECU Reflash Tracker - Auto Run Script (Windows)
echo ================================================

REM Install MinIO if not present
where minio >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing MinIO...
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe' -OutFile 'minio.exe'"
)

REM Backend setup
echo.
echo [Backend Setup]
cd backend

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -q -r requirements.txt
pip install -q aiosqlite

if not exist ".env" (
    copy .env.example .env
    REM Modify .env for local SQLite and MinIO
    powershell -Command "(Get-Content .env) -replace 'DATABASE_URL=.*', 'DATABASE_URL=sqlite+aiosqlite:///./ecu.db' | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace 'MINIO_URL=.*', 'MINIO_URL=http://localhost:9000' | Set-Content .env"
)

echo Initializing database...
python scripts\init_db.py

echo Running migrations...
alembic upgrade head

echo Backend ready

cd ..

REM Frontend setup
echo.
echo [Frontend Setup]
cd frontend

echo Installing dependencies...
call npm install -q

if not exist ".env.local" (
    copy .env.example .env.local
)

echo Frontend ready

cd ..

REM Start MinIO
echo.
echo [Starting MinIO]
if not exist "C:\tmp\minio-data" mkdir "C:\tmp\minio-data"
start "MinIO" minio.exe server "C:\tmp\minio-data" --address :9000

REM Start backend
echo.
echo [Starting Backend]
cd backend
start "Backend" cmd /c "venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
cd ..

REM Start frontend
echo.
echo [Starting Frontend]
cd frontend
start "Frontend" cmd /c "npm run dev"
cd ..

echo.
echo ================================================
echo Project is running!
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo MinIO: http://localhost:9000
echo.
echo Close the command windows to stop services

pause