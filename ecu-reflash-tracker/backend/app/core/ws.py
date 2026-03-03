from fastapi import WebSocket
from typing import Set


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients, removing dead connections."""
        disconnected = set()
        for connection in self.active_connections.copy():
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        for conn in disconnected:
            self.active_connections.discard(conn)


manager = ConnectionManager()


async def emit_event(event_type: str, data: dict):
    """Emit a WebSocket event to all connected clients."""
    await manager.broadcast({"type": event_type, "data": data})
