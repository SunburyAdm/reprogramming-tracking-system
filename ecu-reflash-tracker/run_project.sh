#!/bin/bash

# Script to run the ECU Reflash Tracker project locally without Docker
# Assumes Python 3.11+, Node.js 18+ are installed

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "================================================"
echo "ECU Reflash Tracker - Auto Run Script"
echo "================================================"

# Install MinIO to local bin directory
echo "Installing MinIO to bin directory..."
bash bin/install-minio.sh
echo "✓ MinIO installed"

# Backend setup
echo -e "\n[Backend Setup]"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing aiosqlite for SQLite support..."
pip install aiosqlite

if [ ! -f ".env" ]; then
    echo "Configuring environment file..."
    cp .env.example .env
    # default to SQLite for quick local setup
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=sqlite+aiosqlite:///./ecu.db|' .env
    sed -i 's|MINIO_URL=.*|MINIO_URL=http://localhost:9000|' .env
fi

# check if user is using sqlite or postgres
DBURL=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2-)
if echo "$DBURL" | grep -q '^sqlite'; then
    echo "⚠ Using SQLite database (local file)."
    echo "   To switch to PostgreSQL, update DATABASE_URL in .env accordingly."
    echo "   Example: postgresql://user:pass@localhost:5432/ecu_db"
else
    echo "Using PostgreSQL database: $DBURL"
fi

if echo "$DBURL" | grep -q '^sqlite'; then
    echo "Resetting database for fresh start..."
    rm -f ecu.db
fi

# run migrations before seeding so that init_db can insert data without recreating tables
# also handle PostgreSQL case by skipping removal above if using a different DB
echo "Running database migrations..."
alembic -c alembic/alembic.ini upgrade head

# now seed (init_db creates tables only if missing and inserts demo data)
echo "Seeding database..."
python scripts/init_db.py

echo "Backend setup complete."

cd ..

# Frontend setup
echo -e "\n[Frontend Setup]"
cd frontend

echo "Installing Node.js dependencies..."
npm install

if [ ! -f ".env.local" ]; then
    echo "Configuring frontend environment..."
    cp .env.example .env.local
fi

echo "Frontend setup complete."

cd ..

# Start MinIO
echo -e "\n[Starting MinIO Server]"
mkdir -p /tmp/minio-data
./bin/minio server /tmp/minio-data --address :9000 &
MINIO_PID=$!

# wait for MinIO to accept connections
echo "Waiting for MinIO to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:9000/minio/health/ready > /dev/null; then
        echo "MinIO is ready"
        break
    fi
    sleep 1
done

# Start backend
echo -e "\n[Starting Backend Server]"
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd ..

# Start frontend
echo -e "\n[Starting Frontend Development Server]"
cd frontend
npm run dev &
FRONTEND_PID=$!

cd ..

echo -e "\n================================================"
echo "✅ All services are starting up!"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "MinIO Console: http://localhost:9000"
echo ""
echo "Services are running in the background."
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo 'Stopping services...'; kill $MINIO_PID $BACKEND_PID $FRONTEND_PID; exit" INT
wait