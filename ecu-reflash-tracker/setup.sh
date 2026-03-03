#!/bin/bash
set -e

echo "================================"
echo "ECU Reflash Tracker - Init"
echo "================================"

echo -e "\nSetup backend..."
cd backend
cp .env.example .env || true

echo -e "\nSetup frontend..."
cd ../frontend
cp .env.example .env.local || true

echo -e "\n✓ Setup complete!"
echo ""
echo "To start the system:"
echo "  docker compose up --build"
echo ""
echo "Then access:"
echo "  Frontend:     http://localhost:3000"
echo "  Backend API:  http://localhost:8000/docs"
echo "  MinIO:        http://localhost:9001"
echo ""
