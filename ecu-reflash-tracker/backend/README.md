# Backend API Documentation

FastAPI-based RESTful API for ECU tracking system.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app instance
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py          # Authentication endpoints
│   │   └── ecu.py           # ECU operations endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py          # User model
│   │   ├── ecu.py           # ECU model
│   │   ├── upload.py        # Upload model
│   │   └── history.py       # History/Audit model
│   ├── schemas/
│   │   └── __init__.py      # Pydantic schemas
│   ├── services/
│   │   ├── __init__.py      # Business logic
│   │   ├── ecu.py           # ECU service
│   │   ├── s3.py            # MinIO/S3 service
│   │   └── history.py       # History service
│   └── core/
│       ├── __init__.py
│       ├── config.py        # Settings
│       ├── security.py      # JWT & password hashing
│       └── database.py      # SQLAlchemy setup
├── alembic/
│   ├── env.py
│   ├── alembic.ini
│   ├── script.py.mako
│   └── versions/            # Migration files
├── tests/
│   ├── __init__.py
│   ├── test_auth.py
│   └── test_ecu.py
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Initialize database
alembic upgrade head

# Seed default users
python scripts/seed.py

# Run development server
uvicorn app.main:app --reload
```

## API Endpoints

See http://localhost:8000/docs for interactive Swagger UI.

### Authentication
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user

### ECU Management
- GET `/api/ecus` - List ECUs
- POST `/api/ecus` - Create/scan ECU
- GET `/api/ecus/{id}` - Get ECU details
- POST `/api/ecus/{id}/assign` - Assign to user
- POST `/api/ecus/{id}/release` - Release from user
- POST `/api/ecus/{id}/status` - Update status
- POST `/api/ecus/{id}/lock` - Lock ECU
- POST `/api/ecus/{id}/unlock` - Unlock ECU

### Uploads & History
- POST `/api/ecus/{id}/uploads` - Upload file
- GET `/api/uploads/{id}/download` - Download file
- GET `/api/ecus/{id}/history` - Get history
- GET `/api/ecus/{id}/uploads` - List uploads

### Real-time
- GET `/ws` - WebSocket endpoint

## Testing

```bash
pytest tests/
pytest tests/test_auth.py -v
pytest --cov=app tests/
```

## Deployment

### Production Checklist
1. ✓ Change `SECRET_KEY` to a long random string
2. ✓ Set `ENVIRONMENT=production`
3. ✓ Use strong PostgreSQL password
4. ✓ Enable HTTPS/TLS
5. ✓ Set appropriate CORS origins
6. ✓ Use environment variables for all secrets
7. ✓ Set up monitoring and logging
8. ✓ Configure backup strategy for PostgreSQL
9. ✓ Configure backup for MinIO data
10. ✓ Enable rate limiting (if needed)

## Performance Notes

- Uses async/await for non-blocking I/O
- Connection pooling for PostgreSQL
- Indexes on frequently queried columns
- S3 presigned URLs for secure file access
- WebSocket for real-time updates
