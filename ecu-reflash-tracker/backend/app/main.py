from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.ws import manager
from app.api import auth
from app.api.sessions import router as sessions_router
from app.api.boxes import router as boxes_router
from app.api.reports import router as reports_router
from app.services.s3 import s3_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting ECU Reflash Tracker (Session Mode)...")
    await init_db()
    await s3_service.ensure_bucket_exists()
    yield
    print("Shutting down...")
    await close_db()


app = FastAPI(
    title="ECU Reflash Tracker API",
    description="Industrial ECU reflashing tracker with sessions, boxes and stations",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions_router)
app.include_router(boxes_router)
app.include_router(reports_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)



@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
