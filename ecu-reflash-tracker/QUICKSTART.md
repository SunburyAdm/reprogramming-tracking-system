# Quick Start Guide 🚀

Get the ECU Reflash Tracker running in **5 minutes**.

## Prerequisites
- Docker and Docker Compose installed
- 4GB RAM available
- Ports 3000, 8000, 5432, 9000, 9001 available

## Start (Linux/Mac)
```bash
cd ecu-reflash-tracker
docker compose up --build
```

## Start (Windows)
```cmd
cd ecu-reflash-tracker
docker compose up --build
```

## Access Services

Once all containers are healthy (usually 1-2 minutes):

| Service | URL | Notes |
|---------|-----|-------|
| **Frontend** | http://localhost:3000 | ECU Tracking Web App |
| **API Docs** | http://localhost:8000/docs | Interactive Swagger UI |
| **MinIO Console** | http://localhost:9001 | File Storage Admin (optional) |
| **Database** | localhost:5432 | PostgreSQL (if you have a local client) |

## Login Credentials

```
Admin:  admin@local / admin123
Tech:   tech@local / tech123
```

## First Steps

1. **Open Frontend**: http://localhost:3000
2. **Login** with admin@local / admin123
3. **Click "+ Scan ECU"** button
4. **Manually enter** a barcode: `TEST-001`
5. **Click the barcode** in the table to view details
6. **Click "Take"** to assign it to yourself
7. **Upload a file** in the drawer (any file works)
8. **Watch the history timeline** update automatically

## Common Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Reset database
docker compose down -v
docker compose up --build

# Run backend tests
docker compose exec backend pytest tests/ -v

# Open database shell
docker compose exec postgres psql -U ecu_user -d ecu_db

# Backend shell
docker compose exec backend bash
```

## Troubleshooting

### Port already in use
Change in `docker-compose.yml` ports section

### Backend won't start
```bash
docker compose logs backend
# Check PostgreSQL status first
docker compose logs postgres
```

### Frontend won't load
Wait 30s for backend to be ready, then refresh browser

### Cannot login
```bash
# Reseed database
docker compose exec backend python scripts/seed.py
```

## What's Included

✅ JWT Authentication (admin, tech, viewer roles)
✅ ECU scanning & tracking with QR/barcode
✅ Real-time updates via WebSocket
✅ File uploads (dumps, logs, configs)
✅ Complete audit trail
✅ Optimistic locking for concurrent access
✅ S3-compatible storage (MinIO)
✅ Professional responsive UI

## Next Steps

1. **Explore the API**: http://localhost:8000/docs
2. **Scan more ECUs**: Use camera or manual input
3. **Upload files**: Attach dumps/logs to ECUs
4. **Check history**: View audit trail timeline
5. **Try filters**: Filter by status/assignee
6. **Review code**:
   - Backend: `backend/app/`
   - Frontend: `frontend/src/`
   - Database: `backend/alembic/versions/`

## Full Documentation

- **Main README**: [README.md](README.md)
- **Backend README**: [backend/README.md](backend/README.md)
- **Frontend README**: [frontend/README.md](frontend/README.md)
- **Docker Reference**: [DOCKER.md](DOCKER.md)
- **Project Structure**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

**✨ Ready to go!** The system is fully functional and ready for development. Happy tracking! 🎉
