@echo off
REM Install MinIO binary to local bin directory

setlocal enabledelayedexpansion

set "BIN_DIR=%~dp0"
set "MINIO_BIN=%BIN_DIR%minio.exe"

if exist "%MINIO_BIN%" (
    echo MinIO is already installed at %MINIO_BIN%
    exit /b 0
)

echo Downloading MinIO binary for Windows...
powershell -Command "Invoke-WebRequest -Uri 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe' -OutFile '%MINIO_BIN%'"

if exist "%MINIO_BIN%" (
    echo MinIO installed at %MINIO_BIN%
) else (
    echo Failed to download MinIO
    exit /b 1
)