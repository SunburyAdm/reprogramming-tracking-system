@echo off
REM Initialize project directories and configs for Windows

echo ECU Reflash Tracker - Project Initialization
echo =============================================

REM Backend setup
echo.
echo [1/3] Setting up backend...
if not exist "backend\.env" (
  copy backend\.env.example backend\.env
  echo Created backend\.env
)

REM Frontend setup
echo.
echo [2/3] Setting up frontend...
if not exist "frontend\.env.local" (
  copy frontend\.env.example frontend\.env.local
  echo Created frontend\.env.local
)

REM Check Docker
echo.
echo [3/3] Checking Docker...
where docker >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Docker is installed
) else (
  echo Warning: Docker not found. Please install Docker Desktop
)

echo.
echo Initialization complete!
echo.
echo Next steps:
echo 1. Edit backend\.env if you modified any settings
echo 2. Edit frontend\.env.local if needed  
echo 3. Run: docker compose up --build
echo.
echo Services will be available at:
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:8000/docs
echo   MinIO:        http://localhost:9001
echo.
