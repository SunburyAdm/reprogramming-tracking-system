# ECU Reflash Tracker - Docker Compose Reference

Complete local development environment with all services.

## Services

1. **PostgreSQL 15** (postgres:5432)
   - Database for application data
   - Volume: `postgres_data`

2. **MinIO** (minio:9000, console:9001)
   - S3-compatible object storage for file uploads
   - Volume: `minio_data`

3. **Backend** (backend:8000)
   - FastAPI application
   - Builds from `./backend/Dockerfile`
   - Runs migrations automatically

4. **Frontend** (frontend:3000)
   - React + Vite development server
   - Hot reload enabled
   - Builds from `./frontend/Dockerfile`

## Quick Commands

```bash
# Start services
docker compose up --build

# Start in background
docker compose up -d --build

# View logs
docker compose logs -f

# View specific service logs
docker compose logs backend
docker compose logs frontend

# Stop services
docker compose down

# Remove volumes (reset database)
docker compose down -v

# Rebuild after code changes
docker compose up --build

# Execute command in container
docker compose exec backend bash
docker compose exec backend python -m pytest

# Access database directly
docker compose exec postgres psql -U ecu_user -d ecu_db
```

## Environment Variable Overrides

Create `.env` file in project root to override values:

```bash
# .env
DATABASE_URL=postgresql+asyncpg://ecu_user:ecu_password@postgres:5432/ecu_db
SECRET_KEY=your-custom-secret-key
API_PORT=8000
```

## Database Management

### View All ECUs
```bash
docker compose exec postgres psql -U ecu_user -d ecu_db \
  -c "SELECT id, barcode, status, assignee_id FROM ecus;"
```

### Reset Database
```bash
docker compose down -v
docker compose up --build
# Migrations and seeding run automatically
```

### Backup Database
```bash
docker compose exec postgres pg_dump -U ecu_user ecu_db > backup.sql
```

### Restore Database
```bash
docker compose exec -T postgres psql -U ecu_user ecu_db < backup.sql
```

## MinIO Management

Access MinIO Console: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

### Create Bucket (if needed)
```bash
docker compose exec minio mc mb minio/ecu-uploads
```

### List Objects
```bash
docker compose exec minio mc ls minio/ecu-uploads/
```

## Troubleshooting

### Service won't start
```bash
docker compose up --build --force-recreate
```

### Port already in use
Kill process or change port in docker-compose.yml or .env

### Database won't connect
```bash
docker compose logs postgres
# Check POSTGRES_* environment variables
```

### MinIO issues
```bash
docker compose logs minio
docker compose exec minio mc health live minio
```

### Permissions error
```bash
sudo chown -R $USER docker-volumes/
docker compose down -v
docker compose up --build
```

## Volumes

- `postgres_data` - PostgreSQL database files
- `minio_data` - MinIO object storage

These persist across restarts unless removed with `docker compose down -v`.

## Network

All services communicate via internal Docker network `ecu-network`.

External ports exposed:
- Frontend: 3000
- Backend: 8000
- MinIO API: 9000
- MinIO Console: 9001
- PostgreSQL: 5432 (for local tools)
