#!/bin/bash
# Initialize project directories and configs

echo "ECU Reflash Tracker - Project Initialization"
echo "=============================================="

# Backend setup
echo -e "\n[1/3] Setting up backend..."
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "✓ Created backend/.env"
fi

# Frontend setup
echo -e "\n[2/3] Setting up frontend..."
if [ ! -f "frontend/.env.local" ]; then
  cp frontend/.env.example frontend/.env.local
  echo "✓ Created frontend/.env.local"
fi

# Docker setup
echo -e "\n[3/3] Docker Compose configuration..."
if ! command -v docker &> /dev/null; then
  echo "⚠ Docker not found. Please install Docker Desktop"
else
  echo "✓ Docker is installed"
fi

echo -e "\n✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env if you modified any settings"
echo "2. Edit frontend/.env.local if needed"
echo "3. Run: docker compose up --build"
echo ""
echo "Services will be available at:"
echo "  Frontend:     http://localhost:3000"
echo "  Backend API:  http://localhost:8000/docs"
echo "  MinIO:        http://localhost:9001"
echo ""
