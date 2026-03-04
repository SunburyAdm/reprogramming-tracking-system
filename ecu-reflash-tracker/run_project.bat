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
    echo Downloading MinIO binary...
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe' -OutFile 'minio.exe'"
    echo MinIO downloaded.
)

REM Backend setup
echo.
echo [Backend Setup]
cd backend

if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python dependencies...
pip install -r requirements.txt

echo Installing aiosqlite for SQLite support...
pip install aiosqlite

if not exist ".env" (
    echo Configuring environment file...
    copy .env.example .env
    REM Modify .env for local SQLite and MinIO
    powershell -Command "(Get-Content .env) -replace 'DATABASE_URL=.*', 'DATABASE_URL=sqlite+aiosqlite:///./ecu.db' | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace 'MINIO_URL=.*', 'MINIO_URL=http://localhost:9000' | Set-Content .env"
)

echo Initializing database tables and seed data...
python scripts\init_db.py

echo Running database migrations...
alembic upgrade head

echo Backend setup complete.

cd ..

REM Frontend setup
echo.
echo [Frontend Setup]
cd frontend

echo Installing Node.js dependencies...
call npm install

if not exist ".env.local" (
    echo Configuring frontend environment...
    copy .env.example .env.local
)

echo Frontend setup complete.

cd ..

REM Start MinIO
echo.
echo [Starting MinIO Server]
if not exist "C:\tmp\minio-data" mkdir "C:\tmp\minio-data"
start "MinIO Server" minio.exe server "C:\tmp\minio-data" --address :9000

REM Start backend
echo.
echo [Starting Backend Server]
cd backend
start "Backend Server" cmd /c "venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
cd ..

REM Start frontend
echo.
echo [Starting Frontend Development Server]
cd frontend
start "Frontend Dev Server" cmd /c "npm run dev"
cd ..

echo.
echo ================================================
echo All services are starting up!
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo MinIO Console: http://localhost:9000
echo.
echo Services are running in separate windows.
echo Close the windows to stop the services.
echo Press any key to exit this setup script...

pause >nul