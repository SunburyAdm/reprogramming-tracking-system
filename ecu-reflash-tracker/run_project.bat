@echo off
REM Script to run the ECU Reflash Tracker project locally without Docker on Windows
REM Assumes Python 3.11+, Node.js 18+ are installed

setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo ================================================
echo ECU Reflash Tracker - Auto Run Script (Windows)
echo ================================================

REM Install MinIO to local bin directory
echo Installing MinIO to bin directory...
call bin\install-minio.bat
echo MinIO installed

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

REM check database type
for /f "tokens=1,* delims==" %%A in ('findstr "^DATABASE_URL=" .env') do set DBURL=%%B

echo Using database: "%DBURL%"

REM simple prefix comparison instead of piping
set "PREFIX=!DBURL:~0,6!"
if /I "%PREFIX%"=="sqlite" (
    echo ⚠ Using SQLite database (local file).
    echo    To switch to PostgreSQL, update DATABASE_URL in .env accordingly.
    echo    Example: postgresql://user:pass@localhost:5432/ecu_db
    if exist "ecu.db" del "ecu.db"
)

echo Running database migrations...
alembic -c alembic\\alembic.ini upgrade head

echo Seeding database...
python scripts\init_db.py

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
start "MinIO Server" bin\minio.exe server "C:\tmp\minio-data" --address :9000

REM wait for MinIO
ping -n 1 localhost >nul
REM no easy port check; user must ensure it starts


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