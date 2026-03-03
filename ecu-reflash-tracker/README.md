# ECU Reflash Tracker 🚗

A modern web application for tracking ECU reflashing operations in real-time. Built with FastAPI (Python), React (TypeScript), PostgreSQL, and MinIO for S3-compatible file storage.

## 📋 Features

- **Real-time ECU Tracking**: View ECUs in a Jira-like table with live updates via WebSocket
- **QR/Barcode Scanning**: Scan ECUs using device camera or barcode reader
- **Optimistic Locking**: Concurrent access with version control to prevent conflicts
- **File Management**: Upload dumps, logs, and configs to MinIO S3 storage
- **Complete Audit Trail**: Full history of all ECU operations with timestamps and user tracking
- **JWT Authentication**: Secure login with role-based access (admin, tech, viewer)
- **Responsive UI**: Works on desktop and mobile with professional styling

## 🏗️ Architecture

```
ecu-reflash-tracker/
├── backend/                 # FastAPI application (Python 3.11+)
│   ├── app/
│   │   ├── api/            # API endpoints (auth, ecu, upload)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (ecu, user, s3, history)
│   │   ├── core/           # Configuration, security, database
│   │   └── main.py         # FastAPI app definition
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest tests
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/               # React + Vite application
│   ├── src/
│   │   ├── components/     # React components (ECUTable, ECUDetails, ScanModal)
│   │   ├── pages/          # Pages (LoginPage)
│   │   ├── services/       # API client, QR scanner, WebSocket
│   │   ├── store/          # Zustand state management
│   │   ├── styles/         # Global CSS
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml      # Docker Compose configuration
├── scripts/
│   ├── seed.py            # Database seeding script
│   ├── init-backend.sh    # Backend initialization script
│   └── init-minio.sh      # MinIO initialization script
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Or: Python 3.11+, Node.js 18+, PostgreSQL 15, MinIO

### Option 1: Docker Compose (Recommended)

```bash
# Clone or navigate to project
cd ecu-reflash-tracker

# Start all services
docker compose up --build

# Services will be available at:
# Frontend:     http://localhost:3000
# Backend API:  http://localhost:8000/docs (Swagger)
# MinIO:        http://localhost:9001 (Console)
```

Default credentials:
- **Admin**: `admin@local` / `admin123`
- **Tech**: `tech@local` / `tech123`

### Option 2: Local Development

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Start PostgreSQL and MinIO (either locally or via Docker)
# Update DATABASE_URL and MinIO settings in .env

# Run migrations
alembic upgrade head

# Seed initial data
python scripts/seed.py

# Start server
uvicorn app.main:app --reload
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env.local

# Start dev server
npm run dev
```

## 📚 API Documentation

Once the backend is running, visit: **http://localhost:8000/docs**

### Core Endpoints

#### Authentication
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user info

#### ECU Operations
- `GET /api/ecus` - List ECUs with filters
- `POST /api/ecus` - Scan/create ECU by barcode
- `GET /api/ecus/{id}` - Get ECU details
- `POST /api/ecus/{id}/assign` - Assign ECU to current user
- `POST /api/ecus/{id}/release` - Release ECU
- `POST /api/ecus/{id}/status` - Update ECU status
- `POST /api/ecus/{id}/lock` - Lock ECU (30 min)
- `POST /api/ecus/{id}/unlock` - Unlock ECU
- `GET /api/ecus/{id}/history` - Get ECU history
- `GET /api/ecus/{id}/uploads` - List ECU uploads

#### File Management
- `POST /api/ecus/{id}/uploads` - Upload file (dump/log/config)
- `GET /api/uploads/{id}/download` - Get presigned download URL

#### Real-time
- `GET /ws` - WebSocket connection for live updates

## 🔐 Authentication & Authorization

### User Roles
- **Admin**: Full access, can manage users and settings
- **Tech**: Can perform ECU operations, upload files, view all histories
- **Viewer**: Read-only access, cannot modify data

### JWT Tokens
- Tokens expire after 480 minutes (8 hours)
- Include token in `Authorization: Bearer {token}` header
- Stored in `localStorage` on frontend

## 💾 Database Schema

```sql
-- Users
users {
  id UUID PK
  email VARCHAR UNIQUE
  password_hash VARCHAR
  name VARCHAR
  role ENUM(admin, tech, viewer)
  created_at TIMESTAMP
}

-- ECUs
ecus {
  id UUID PK
  barcode VARCHAR UNIQUE
  serial VARCHAR
  hw_part_no VARCHAR
  hw_version VARCHAR
  sw_version VARCHAR
  status VARCHAR
  assignee_id FK users
  lock_owner_id FK users
  lock_until TIMESTAMP
  last_seen TIMESTAMP
  created_at TIMESTAMP
  updated_at TIMESTAMP
  version INT (optimistic locking)
}

-- Uploads
uploads {
  id UUID PK
  ecu_id FK ecus
  uploader_id FK users
  filename VARCHAR
  s3_key VARCHAR
  file_size INT
  checksum_sha256 VARCHAR
  kind ENUM(dump, log, config)
  notes TEXT
  created_at TIMESTAMP
}

-- History/Audit
ecu_history {
  id UUID PK
  ecu_id FK ecus
  user_id FK users
  action VARCHAR (created, scanned, assigned, etc.)
  data JSONB
  created_at TIMESTAMP
}
```

## 🔄 Optimistic Locking Pattern

Prevents concurrent modification conflicts:

```bash
# Get current version
GET /api/ecus/123 → { ..., version: 5 }

# Update with expected version
POST /api/ecus/123/status
{
  "status": "done",
  "expected_version": 5
}

# If version mismatch → 409 Conflict
# Frontend refreshes and retries with new version
```

## 📤 File Upload Flow

1. User selects file + kind (dump/log/config) + notes
2. Frontend sends `multipart/form-data` with file
3. Backend:
   - Calculates SHA256 checksum
   - Uploads to MinIO with key: `ecus/{ecu_id}/uploads/{timestamp}_{kind}_{filename}`
   - Saves metadata to database
   - Creates history entry
   - Emits WebSocket event
4. Frontend shows presigned download URL

## 🌐 WebSocket Updates

Real-time updates via `/ws` endpoint:

```javascript
// Frontend connects and receives events:
{
  "type": "ECU_UPDATED",
  "data": { /* updated ECU object */ }
}

{
  "type": "UPLOAD_ADDED",
  "data": { /* new upload object */ }
}
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/
```

### Manual API Testing with curl
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@local", "password": "admin123"}'
# Response: { "access_token": "...", "token_type": "bearer" }

# Scan ECU
curl -X POST http://localhost:8000/api/ecus \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "ECU-2024-001",
    "serial": "SN123456"
  }'

# Assign ECU (with optimistic locking)
curl -X POST http://localhost:8000/api/ecus/{id}/assign \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"expected_version": 1}'

# Upload file
curl -X POST http://localhost:8000/api/ecus/{id}/uploads \
  -H "Authorization: Bearer {token}" \
  -F "file=@dump.bin" \
  -F "kind=dump" \
  -F "notes=Production build v2.1"

# Get download URL
curl -X GET http://localhost:8000/api/uploads/{upload_id}/download \
  -H "Authorization: Bearer {token}"

# Update status
curl -X POST http://localhost:8000/api/ecus/{id}/status \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "expected_version": 2}'
```

## 🌍 GitHub Codespaces Setup

### Create Codespace
1. Fork or open repository on GitHub
2. Create Codespace: `Code → Codespaces → Create codespace`
3. Wait for initialization (~2 minutes)

### Run in Codespaces
```bash
# Forward ports (automatic for 3000, 8000, 9001)
docker compose up --build

# Access via forwarded URLs:
# Frontend: https://<your-codespace>-3000.app.github.dev
# API Docs: https://<your-codespace>-8000.app.github.dev/docs
# MinIO:    https://<your-codespace>-9001.app.github.dev
```

The Codespace includes all necessary tools (Docker, Python, Node.js, git).

## 📝 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://ecu_user:ecu_password@postgres:5432/ecu_db
SECRET_KEY=your-long-random-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
MINIO_URL=http://minio:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_BUCKET=ecu-uploads
S3_REGION=us-east-1
API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:8000
```

## 🔧 Development Workflow

### Adding a New Feature

1. **Backend**:
   - Create model in `app/models/`
   - Create schema in `app/schemas/`
   - Create service in `app/services/`
   - Create API endpoint in `app/api/`
   - Create migration: `alembic revision --autogenerate -m "description"`
   - Add tests in `tests/`

2. **Frontend**:
   - Create component in `src/components/`
   - Add API method in `src/services/api.ts`
   - Update store if needed in `src/store/index.ts`
   - Add styling in component `.css` file

3. **Test**:
   ```bash
   docker compose up --build
   # or locally: npm run dev / uvicorn app.main:app --reload
   ```

### Database Migrations

```bash
# Auto-generate migration from models
cd backend
alembic revision --autogenerate -m "Add new column"

# Apply migrations
alembic upgrade head

# Downgrade
alembic downgrade -1
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change in docker-compose.yml or .env
# Or kill process: lsof -i :3000 | kill -9 <PID>
```

### Database Connection Error
```bash
# Ensure PostgreSQL is running
docker compose ps
docker compose logs postgres

# Check DATABASE_URL in backend .env
```

### MinIO Bucket Not Found
```bash
# Manually create bucket
docker compose exec minio mc mb minio/ecu-uploads

# Or check health
docker compose logs minio
```

### Token Expired
- Clear browser storage: `localStorage.clear()`
- Login again
- Token expires after 480 minutes by default

### WebSocket Connection Issues
- Check browser console for errors
- Ensure backend is running
- Check FRONTEND_URL in backend .env matches actual URL

## 📦 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | FastAPI | 0.104+ |
| | SQLAlchemy | 2.0+ |
| | PostgreSQL+asyncpg | 15+ |
| | Alembic | 1.13+ |
| | Python | 3.11+ |
| **Frontend** | React | 18.2+ |
| | Vite | 5.0+ |
| | TypeScript | 5.2+ |
| | Zustand | 4.4+ |
| | Axios | 1.6+ |
| **Storage** | MinIO | latest |
| **Infra** | Docker | 20.10+ |
| | Docker Compose | 2.0+ |

## 📄 License

MIT

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/my-feature`
4. Create Pull Request

## 📧 Support

For issues and questions, use GitHub Issues.

---

**Ready to get started?** Run `docker compose up --build` and visit http://localhost:3000! 🚀
