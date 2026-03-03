#!/bin/bash
set -e

echo "================================"
echo "ECU Reflash Tracker - Backend Init"
echo "================================"

echo -e "\n→ Running database migrations..."
cd /app/backend
alembic upgrade head

echo -e "\n→ Seeding initial data..."
python scripts/seed.py

echo -e "\n✓ Backend initialization complete!"
