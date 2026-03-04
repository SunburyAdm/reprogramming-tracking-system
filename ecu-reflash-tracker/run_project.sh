#!/bin/bash

# Script to run the ECU Reflash Tracker project locally without Docker
# Assumes Python 3.11+, Node.js 18+ are installed

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "================================================"
echo "ECU Reflash Tracker - Auto Run Script"
echo "================================================"

# Install MinIO if not present
if ! command -v minio &> /dev/null; then
    echo "Installing MinIO..."
    wget -q https://dl.min.io/server/minio/release/linux-amd64/minio -O minio
    chmod +x minio
fi

# Backend setup
echo -e "\n[Backend Setup]"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt
pip install -q aiosqlite

if [ ! -f ".env" ]; then
    cp .env.example .env
    # Modify .env for local SQLite and MinIO
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=sqlite+aiosqlite:///./ecu.db|' .env
    sed -i 's|MINIO_URL=.*|MINIO_URL=http://localhost:9000|' .env
fi

echo "Initializing database..."
python scripts/init_db.py

echo "Running migrations..."
alembic upgrade head

echo "✓ Backend ready"

cd ..

# Frontend setup
echo -e "\n[Frontend Setup]"
cd frontend

echo "Installing dependencies..."
npm install -q

if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
fi

echo "✓ Frontend ready"

cd ..

# Start MinIO
echo -e "\n[Starting MinIO]"
mkdir -p /tmp/minio-data
./minio server /tmp/minio-data --address :9000 &
MINIO_PID=$!

# Start backend
echo -e "\n[Starting Backend]"
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd ..

# Start frontend
echo -e "\n[Starting Frontend]"
cd frontend
npm run dev &
FRONTEND_PID=$!

cd ..

echo -e "\n================================================"
echo "✅ Project is running!"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "MinIO: http://localhost:9000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo 'Stopping services...'; kill $MINIO_PID $BACKEND_PID $FRONTEND_PID; exit" INT
wait