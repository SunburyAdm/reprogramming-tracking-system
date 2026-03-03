@echo off
REM Install and setup requirements locally (development) for Windows
REM Requires: Python 3.11+, Node.js 18+, PostgreSQL 15, MinIO

echo ================================================
echo ECU Reflash Tracker - Local Setup (Windows)
echo ================================================

REM Backend setup
echo.
echo [Backend Setup]
cd backend

python --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python not found. Please install Python 3.11+
    exit /b 1
)
echo Python found

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -q -r requirements.txt

if not exist ".env" (
    copy .env.example .env
)
echo Backend configured

cd ..

REM Frontend setup
echo.
echo [Frontend Setup]
cd frontend

npm --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo NPM not found. Please install Node.js 18+
    exit /b 1
)
echo NPM found

echo Installing dependencies...
call npm install -q

if not exist ".env.local" (
    copy .env.example .env.local
)
echo Frontend configured

cd ..

echo.
echo ================================================
echo Setup Complete!
echo.
echo Next steps:
echo 1. Ensure PostgreSQL and MinIO are running locally
echo 2. Update database/MinIO settings in .env files
echo 3. Run backend: cd backend ^&^& venv\Scripts\activate.bat ^&^& uvicorn app.main:app --reload
echo 4. Run frontend: cd frontend ^&^& npm run dev
echo 5. Open: http://localhost:3000
echo.
