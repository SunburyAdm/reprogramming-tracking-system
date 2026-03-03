from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.services.report_service import ReportService
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/sessions", tags=["reports"])


@router.get("/{session_id}/report.xlsx")
async def session_report(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    xlsx_bytes = await ReportService.generate_session_report(db, session_id)
    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}.xlsx"},
    )


@router.get("/{session_id}/boxes/{box_id}/report.xlsx")
async def box_report(
    session_id: UUID,
    box_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    xlsx_bytes = await ReportService.generate_box_report(db, session_id, box_id)
    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=box_{box_id}.xlsx"},
    )


@router.get("/{session_id}/analytics")
async def session_analytics(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await AnalyticsService.get_session_analytics(db, session_id)
