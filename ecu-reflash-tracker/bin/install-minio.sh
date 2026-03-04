#!/bin/bash

# Install MinIO binary to local bin directory

set -e

BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINIO_BIN="$BIN_DIR/minio"

if [ -f "$MINIO_BIN" ]; then
    echo "✓ MinIO is already installed at $MINIO_BIN"
    exit 0
fi

echo "Downloading MinIO binary..."

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        MINIO_URL="https://dl.min.io/server/minio/release/linux-amd64/minio"
    elif [ "$ARCH" = "aarch64" ]; then
        MINIO_URL="https://dl.min.io/server/minio/release/linux-arm64/minio"
    else
        echo "Unsupported architecture: $ARCH"
        exit 1
    fi
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        MINIO_URL="https://dl.min.io/server/minio/release/darwin-amd64/minio"
    elif [ "$ARCH" = "arm64" ]; then
        MINIO_URL="https://dl.min.io/server/minio/release/darwin-arm64/minio"
    else
        echo "Unsupported architecture: $ARCH"
        exit 1
    fi
else
    echo "Unsupported OS: $OS"
    exit 1
fi

echo "Downloading from: $MINIO_URL"
wget -q "$MINIO_URL" -O "$MINIO_BIN"
chmod +x "$MINIO_BIN"

echo "✓ MinIO installed at $MINIO_BIN"