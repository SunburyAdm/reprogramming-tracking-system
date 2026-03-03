.
├── README.md                          # Main project documentation
├── DOCKER.md                          # Docker Compose reference
├── docker-compose.yml                 # Docker Compose configuration
├── setup.sh                          # Setup initialization script
├── init.sh                           # Bash initialization script
├── init.bat                          # Windows initialization script
├── Makefile                          # Make commands for common tasks
├── .gitignore                        # Git ignore rules
└── .npmrc                            # NPM configuration

backend/
├── README.md                         # Backend documentation
├── Dockerfile                        # Backend Docker image
├── requirements.txt                  # Python dependencies
├── .env.example                      # Environment variables template
├── .gitignore                        # Python-specific ignores
├── pytest.ini                        # Pytest configuration
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI application instance
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py                 # Authentication endpoints
│   │   └── ecu.py                  # ECU operations endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py                 # User (admin, tech, viewer) model
│   │   ├── ecu.py                  # ECU main model with version field
│   │   ├── upload.py               # File upload metadata model
│   │   └── history.py              # Audit trail model
│   ├── schemas/
│   │   └── __init__.py             # Pydantic request/response schemas
│   ├── services/
│   │   ├── __init__.py             # UserService, UploadService
│   │   ├── ecu.py                  # ECU business logic (assign, lock, etc.)
│   │   ├── s3.py                   # MinIO S3 service
│   │   └── history.py              # History audit service
│   └── core/
│       ├── __init__.py
│       ├── config.py               # Settings from environment
│       ├── security.py             # JWT and password hashing
│       └── database.py             # SQLAlchemy async setup
├── alembic/
│   ├── env.py                      # Alembic environment
│   ├── alembic.ini                 # Alembic configuration
│   ├── script.py.mako              # Migration template
│   └── versions/
│       └── 001_initial.py          # Initial schema migration
├── tests/
│   ├── __init__.py
│   ├── test_auth.py                # Auth endpoint tests
│   └── test_ecu.py                 # ECU endpoint tests
└── scripts/
    └── seed.py                     # Database seeding script

frontend/
├── README.md                        # Frontend documentation
├── Dockerfile                       # Frontend Docker image
├── .env.example                     # Environment template
├── .env.docker                      # Docker-specific environment
├── .eslintrc.json                   # ESLint configuration
├── .gitignore                       # Node-specific ignores
├── package.json                     # NPM dependencies
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript configuration
├── tsconfig.node.json               # TypeScript Node config
├── index.html                       # HTML entry point
└── src/
    ├── App.tsx                      # Main React component
    ├── App.css
    ├── main.tsx                     # React DOM render
    ├── pages/
    │   └── LoginPage.tsx            # Login form
    │   └── LoginPage.css
    ├── components/
    │   ├── ECUTable.tsx             # Main ECU list table
    │   ├── ECUTable.css
    │   ├── ECUDetails.tsx           # Side drawer with details/history/uploads
    │   ├── ECUDetails.css
    │   ├── ScanModal.tsx            # QR/barcode scanner modal
    │   └── ScanModal.css
    ├── services/
    │   ├── api.ts                   # Axios API client with interceptors
    │   ├── qr.ts                    # QR scanner hook (jsQR library)
    │   └── websocket.ts             # WebSocket hook for real-time updates
    ├── store/
    │   └── index.ts                 # Zustand stores (Auth, ECU, Filter)
    └── styles/
        └── global.css               # Global styling and utilities

scripts/
├── seed.py                          # Python script to seed users and buckets
├── init-backend.sh                  # Backend initialization script
└── init-minio.sh                    # MinIO bucket initialization script
