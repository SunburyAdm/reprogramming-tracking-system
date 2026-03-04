# MinIO Binary Directory

This directory contains the MinIO server executable for the ECU Reflash Tracker project.

## Automatic Installation

The `run_project.sh` (Linux/macOS) and `run_project.bat` (Windows) scripts will automatically download and install MinIO to this directory on first run.

### Installation Scripts

- **Linux/macOS**: Run `./bin/install-minio.sh` to manually install MinIO
- **Windows**: Run `bin\install-minio.bat` to manually install MinIO

### Manual Installation

If you prefer to install MinIO manually:

1. Download the appropriate MinIO binary for your OS from https://dl.min.io/server/minio/release/
2. Place it in this `bin` directory:
   - Linux/macOS: `minio` (executable)
   - Windows: `minio.exe`
3. Make sure it's executable (Linux/macOS): `chmod +x bin/minio`

### Supported Platforms

The installation scripts support:

- **Linux**: x86_64, ARM64
- **macOS**: x86_64, ARM64 (Apple Silicon)
- **Windows**: AMD64 (x86_64)

### What's Included

When downloaded, MinIO is a single binary executable that includes:
- MinIO server
- MinIO console (S3-compatible object storage)
- Ready-to-use S3 API

## Notes

- MinIO is used for local S3-compatible object storage in development
- The binary is automatically downloaded from the official MinIO CDN on first run
- This directory can be committed to version control without the binary itself (using `.gitkeep`)
