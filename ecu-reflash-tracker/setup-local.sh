#!/bin/bash

# Install and setup requirements locally (development)
# Requires: Python 3.11+, Node.js 18+, PostgreSQL 15, MinIO

set -e

echo "================================================"
echo "ECU Reflash Tracker - Local Setup"
echo "================================================"

# Backend setup
echo -e "\n[Backend Setup]"
cd backend

if command -v python3 &> /dev/null; then
    echo "✓ Python 3 found"
else
    echo "✗ Python 3 not found. Please install Python 3.11+"
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate || . venv/Scripts/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt

cp .env.example .env
echo "✓ Backend configured"

cd ..

# Frontend setup
echo -e "\n[Frontend Setup]"
cd frontend

if command -v npm &> /dev/null; then
    echo "✓ NPM found"
else
    echo "✗ NPM not found. Please install Node.js 18+"
    exit 1
fi

echo "Installing dependencies..."
npm install -q

cp .env.example .env.local
echo "✓ Frontend configured"

cd ..

echo -e "\n================================================"
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Ensure PostgreSQL and MinIO are running locally"
echo "2. Update database/MinIO settings in .env files"
echo "3. Run backend: cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "4. Run frontend: cd frontend && npm run dev"
echo "5. Open: http://localhost:3000"
echo ""
