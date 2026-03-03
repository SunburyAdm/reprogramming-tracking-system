#!/bin/bash
set -e

echo "Waiting for MinIO..."
while ! nc -z minio 9000; do
  sleep 1
done

echo "MinIO is ready. Initializing bucket..."

# Create bucket
mc --no-sign-request alias set minio http://minio:9000 minioadmin minioadmin || true
mc --no-sign-request mb minio/ecu-uploads --ignore-existing || true

echo "MinIO bucket initialized"
