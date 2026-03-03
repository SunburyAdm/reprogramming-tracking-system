# 📚 Project Index

**ECU Reflash Tracker** - Complete monorepo for tracking ECU reflashing operations.

## 🚀 Getting Started

**Start here**: [QUICKSTART.md](QUICKSTART.md) - 5-minute setup guide

```bash
docker compose up --build
# Then open: http://localhost:3000
```

## 📖 Documentation

1. **[README.md](README.md)** ⭐ START HERE
   - Complete project overview
   - Architecture explanation
   - API endpoints reference
   - Database schema
   - WebSocket updates
   - Testing instructions
   - Codespaces setup

2. **[QUICKSTART.md](QUICKSTART.md)** ⏱️
   - 5-minute setup
   - Service URLs
   - Login credentials
   - Troubleshooting tips

3. **[DELIVERY.md](DELIVERY.md)** 📦
   - Complete feature list
   - File manifest
   - Technology stack
   - Deployment options
   - Next steps for development

4. **[DOCKER.md](DOCKER.md)** 🐳
   - Docker Compose reference
   - Service management
   - Database operations
   - Environment variables

5. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** 📁
   - Detailed directory tree
   - File descriptions
   - Component organization

6. **[backend/README.md](backend/README.md)** 🔧
   - Backend architecture
   - Installation instructions
   - API endpoints
   - Testing
   - Deployment checklist

7. **[frontend/README.md](frontend/README.md)** ⚛️
   - Frontend structure
   - Component guide
   - State management
   - API integration
   - Production build

## 📂 Project Structure

```
ecu-reflash-tracker/
├── docker-compose.yml          # Main orchestration
├── README.md                   # Main documentation
├── QUICKSTART.md              # 5-minute guide
├── DELIVERY.md                # Feature & file list
├── DOCKER.md                  # Docker reference
├── PROJECT_STRUCTURE.md       # File structure
├── Makefile                   # Common commands
├── init.sh / init.bat         # Setup scripts
├── setup-local.sh / .bat      # Local dev setup
│
├── backend/                    # FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── README.md
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── core/
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Pytest tests
│   └── scripts/               # Utility scripts
│
├── frontend/                   # React + Vite
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── README.md
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── store/
│       └── styles/
│
└── scripts/                    # Init scripts
    ├── seed.py
    ├── init-backend.sh
    └── init-minio.sh
```

## ✨ Key Features

✅ **Real-time ECU Tracking** - WebSocket updates
✅ **QR/Barcode Scanning** - Camera integration
✅ **Optimistic Locking** - Concurrent access safe
✅ **File Management** - S3-compatible uploads
✅ **Complete Audit Trail** - History tracking
✅ **JWT Authentication** - Role-based access
✅ **Professional UI** - Responsive design
✅ **Docker Ready** - Instant deployment

## 🔥 Quick Commands

```bash
# Start system
docker compose up --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop
docker compose down

# Reset database
docker compose down -v && docker compose up --build

# Run tests
docker compose exec backend pytest tests/ -v

# Database shell
docker compose exec postgres psql -U ecu_user -d ecu_db

# Backend shell
docker compose exec backend bash

# View with Make
make help
make up
make down
make test
```

## 📱 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | admin@local / admin123 |
| API Docs | http://localhost:8000/docs | N/A |
| MinIO | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | localhost:5432 | ecu_user / ecu_password |

## 🏗️ Architecture

### Backend Stack
- **Framework**: FastAPI (async Python)
- **ORM**: SQLAlchemy 2.0 (async)
- **Database**: PostgreSQL 15
- **Migrations**: Alembic
- **Storage**: MinIO (S3-compatible)
- **Auth**: JWT with bcrypt
- **Real-time**: WebSocket
- **Testing**: pytest

### Frontend Stack
- **Framework**: React 18
- **Build**: Vite 5
- **Language**: TypeScript 5
- **State**: Zustand
- **HTTP**: Axios
- **Styling**: CSS3
- **Scanning**: jsQR

### Infrastructure
- **Containers**: Docker
- **Orchestration**: Docker Compose
- **Services**: 4 (postgres, minio, backend, frontend)

## 🚀 What Works Out of the Box

1. ✅ **Login/Authentication** - JWT tokens
2. ✅ **User Management** - Admin, Tech, Viewer roles
3. ✅ **ECU Scanning** - QR/barcode or manual
4. ✅ **ECU Tracking** - Full CRUD with versions
5. ✅ **Assignment** - Take/release with locking
6. ✅ **Uploads** - Dump/log/config files to MinIO
7. ✅ **History** - Complete audit trail
8. ✅ **Real-time** - WebSocket updates
9. ✅ **Database** - Auto-migrations & seeding
10. ✅ **UI** - Professional responsive design

## 📊 Database Schema

```sql
-- 4 tables with proper relationships
users (id, email, password_hash, name, role, created_at)
ecus (id, barcode, serial, hw_part_no, status, assignee_id, version, ...)
uploads (id, ecu_id, uploader_id, filename, s3_key, kind, notes, ...)
ecu_history (id, ecu_id, action, data, created_at, ...)
```

## 🔐 Authentication

Default accounts (auto-seeded):
```
admin@local / admin123  (admin role)
tech@local / tech123    (tech role)
```

JWT tokens expire after 480 minutes (8 hours).

## 🧪 Testing

```bash
# Backend tests
docker compose exec backend pytest tests/ -v

# Manual API testing
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@local", "password": "admin123"}'
```

## 📋 Checklist for Development

- [ ] Run `docker compose up --build`
- [ ] Login at http://localhost:3000
- [ ] Scan first ECU
- [ ] Assign to yourself
- [ ] Upload a test file
- [ ] View history timeline
- [ ] Check API docs at http://localhost:8000/docs
- [ ] Explore database: `docker compose exec postgres psql -U ecu_user -d ecu_db`
- [ ] Read backend/README.md for architecture details
- [ ] Read frontend/README.md for component details

## 🌐 Codespaces Deployment

1. Create Codespace from GitHub repository
2. Wait for initialization
3. Run: `docker compose up --build`
4. Use port forwarding to access services
5. All tools (Docker, Python, Node) pre-installed

## 🐛 Common Issues & Solutions

**Port in use**: Modify docker-compose.yml or use different ports
**Database error**: Check PostgreSQL logs with `docker compose logs postgres`
**Frontend won't load**: Wait 30s for backend, refresh browser
**Cannot login**: Run `docker compose exec backend python scripts/seed.py`
**MinIO issues**: Check with `docker compose logs minio`

## 📚 Learning Resources

- **FastAPI**: https://fastapi.tiangolo.com
- **SQLAlchemy**: https://docs.sqlalchemy.org
- **React**: https://react.dev
- **Vite**: https://vitejs.dev
- **TypeScript**: https://www.typescriptlang.org
- **Zustand**: https://github.com/pmndrs/zustand

## 🎯 Next Steps

1. **Immediate**: Run `docker compose up --build`
2. **Short-term**: Explore UI and test features
3. **Medium-term**: Review code and understand architecture
4. **Long-term**: Customize for your needs, add features, deploy

## 💬 Code Organization

**Backend**: `/backend/app/`
- `api/` - HTTP endpoints
- `models/` - SQLAlchemy ORM
- `schemas/` - Pydantic validation
- `services/` - Business logic
- `core/` - Config & utilities

**Frontend**: `/frontend/src/`
- `pages/` - Full page components
- `components/` - Reusable components
- `services/` - API & utilities
- `store/` - Zustand state
- `styles/` - CSS files

## 🎉 Ready to Go!

Everything is set up and ready to use. Start with:

```bash
cd ecu-reflash-tracker
docker compose up --build
```

Then visit http://localhost:3000 and login with `admin@local / admin123`.

---

**Questions?** Check the relevant README files first:
- General: [README.md](README.md)
- Quick start: [QUICKSTART.md](QUICKSTART.md)
- Backend: [backend/README.md](backend/README.md)
- Frontend: [frontend/README.md](frontend/README.md)
- Docker: [DOCKER.md](DOCKER.md)
- Complete feature list: [DELIVERY.md](DELIVERY.md)

Happy coding! 🚀
