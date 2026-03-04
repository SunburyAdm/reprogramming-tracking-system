@echo off
REM Run ECU Reflash Tracker using Docker Engine on Windows (WSL2)

REM This script expects Docker Engine with WSL2 integration and the
REM 'docker' command to be available (Docker Desktop not required).

cd /d "%~dp0" 
cd ecu-reflash-tracker

echo ===============================================
echo Starting ECU Reflash Tracker with Docker Compose
echo ===============================================

REM build images
docker compose build

echo Bringing up services...
docker compose up -d

echo.
echo Services started.
echo Postgres: localhost:5432
echo MinIO: http://localhost:9000 (console at :9001)
echo Backend API: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Use "docker compose logs -f" to follow output or "docker compose down" to stop.
