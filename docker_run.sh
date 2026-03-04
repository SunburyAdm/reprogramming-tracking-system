#!/bin/bash

# Run the ECU Reflash Tracker using Docker Engine/Compose
# This script assumes you have Docker Engine installed and the
# `docker` CLI accessible inside your WSL2 or Linux environment.
# No Docker Desktop is required; only the engine.

set -e

WORKDIR="$(pwd)"
cd ecu-reflash-tracker

echo "================================================"
echo "Starting ECU Reflash Tracker with Docker Compose"
echo "================================================"

# ensure images are built and containers recreated
# with engine/compose v2 use 'docker compose' (no hyphen)
docker compose build

echo "Bringing up services..."
docker compose up -d

echo ""
echo "Services started."
echo "Postgres: localhost:5432"
echo "MinIO: http://localhost:9000 (console at :9001)"
echo "Backend API: http://localhost:8000"
echo "Frontend: http://localhost:3000"

echo "Use 'docker compose logs -f' to follow output, or 'docker compose down' to stop."

cd "$WORKDIR"