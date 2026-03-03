from typing import Any, Dict, List
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models import Session, Station, Box, SessionBoxECU, FlashAttempt


class AnalyticsService:

    @staticmethod
    async def get_session_analytics(
        db: AsyncSession,
        session_id: UUID,
    ) -> Dict[str, Any]:
        """
        Return a comprehensive analytics dict for a session.

        Top-level keys:
          - session_id
          - total_boxes
          - completed_boxes
          - blocked_boxes
          - in_progress_boxes
          - pending_boxes
          - learning_boxes
          - total_ecus
          - success_ecus
          - failed_ecus
          - flashing_ecus
          - rework_pending_ecus
          - learned_ecus
          - overall_failure_rate  (0.0–100.0)
          - total_flash_attempts
          - avg_flash_time_seconds
          - max_flash_time_seconds
          - min_flash_time_seconds
          - boxes  (list of per-box KPI dicts)
        """
        # ----- session -----------------------------------------------------
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            return {"error": f"Session {session_id} not found"}

        # ----- boxes -------------------------------------------------------
        boxes_result = await db.execute(
            select(Box).where(Box.session_id == session_id)
        )
        boxes: List[Box] = boxes_result.scalars().all()
        box_ids = [b.id for b in boxes]

        total_boxes = len(boxes)
        completed_boxes = sum(1 for b in boxes if b.status == "completed")
        blocked_boxes = sum(1 for b in boxes if b.status == "blocked")
        in_progress_boxes = sum(1 for b in boxes if b.status == "in_progress")
        pending_boxes = sum(1 for b in boxes if b.status == "pending")
        learning_boxes = sum(1 for b in boxes if b.status == "learning")

        # ----- ECUs --------------------------------------------------------
        all_ecus: List[SessionBoxECU] = []
        if box_ids:
            ecus_result = await db.execute(
                select(SessionBoxECU).where(
                    SessionBoxECU.session_id == session_id
                )
            )
            all_ecus = ecus_result.scalars().all()

        total_ecus = len(all_ecus)
        success_ecus = sum(1 for e in all_ecus if e.status == "success")
        failed_ecus = sum(1 for e in all_ecus if e.status == "failed")
        flashing_ecus = sum(1 for e in all_ecus if e.status == "flashing")
        rework_pending_ecus = sum(1 for e in all_ecus if e.status == "rework_pending")
        learned_ecus = sum(1 for e in all_ecus if e.status == "learned")

        overall_failure_rate = (
            round((failed_ecus / total_ecus) * 100.0, 2) if total_ecus > 0 else 0.0
        )

        # ----- flash attempts ----------------------------------------------
        all_attempts: List[FlashAttempt] = []
        if all_ecus:
            ecu_ids = [e.id for e in all_ecus]
            attempts_result = await db.execute(
                select(FlashAttempt).where(
                    FlashAttempt.ecu_context_id.in_(ecu_ids)
                )
            )
            all_attempts = attempts_result.scalars().all()

        total_flash_attempts = len(all_attempts)
        durations = [a.duration_seconds for a in all_attempts if a.duration_seconds is not None]
        avg_flash_time = int(sum(durations) / len(durations)) if durations else 0
        max_flash_time = max(durations) if durations else 0
        min_flash_time = min(durations) if durations else 0

        # ----- station name lookup ----------------------------------------
        stations_result = await db.execute(
            select(Station).where(Station.session_id == session_id)
        )
        station_map: Dict[UUID, str] = {
            s.id: s.name for s in stations_result.scalars().all()
        }

        # ----- per-box KPIs -----------------------------------------------
        ecus_by_box: Dict[UUID, List[SessionBoxECU]] = {}
        for ecu in all_ecus:
            ecus_by_box.setdefault(ecu.box_id, []).append(ecu)

        attempts_by_ecu: Dict[UUID, List[FlashAttempt]] = {}
        for a in all_attempts:
            attempts_by_ecu.setdefault(a.ecu_context_id, []).append(a)

        boxes_kpi: List[Dict[str, Any]] = []
        for box in boxes:
            box_ecus = ecus_by_box.get(box.id, [])
            b_total = len(box_ecus)
            b_success = sum(1 for e in box_ecus if e.status == "success")
            b_failed = sum(1 for e in box_ecus if e.status == "failed")
            b_rework = sum(1 for e in box_ecus if e.status == "rework_pending")
            b_flashing = sum(1 for e in box_ecus if e.status == "flashing")
            b_learned = sum(1 for e in box_ecus if e.status == "learned")

            b_times = [
                e.total_time_seconds
                for e in box_ecus
                if e.total_time_seconds is not None
            ]
            b_avg_time = int(sum(b_times) / len(b_times)) if b_times else 0
            b_max_time = max(b_times) if b_times else 0
            b_min_time = min(b_times) if b_times else 0
            b_total_time = sum(b_times)

            b_fail_rate = (
                round((b_failed / b_total) * 100.0, 2) if b_total > 0 else 0.0
            )

            # Count total attempts across all ECUs in this box
            box_attempts = []
            for ecu in box_ecus:
                box_attempts.extend(attempts_by_ecu.get(ecu.id, []))

            b_attempt_count = len(box_attempts)
            b_success_attempts = sum(1 for a in box_attempts if a.result == "success")
            b_failed_attempts = sum(1 for a in box_attempts if a.result == "failed")

            station_name = (
                station_map.get(box.assigned_station_id, "—")
                if box.assigned_station_id
                else "—"
            )

            box_kpi: Dict[str, Any] = {
                "box_id": str(box.id),
                "box_serial": box.box_serial,
                "status": box.status,
                "assigned_station_id": str(box.assigned_station_id) if box.assigned_station_id else None,
                "assigned_station_name": station_name,
                "inventory_frozen": box.inventory_frozen,
                "frozen_at": box.frozen_at.isoformat() if box.frozen_at else None,
                "completed_at": box.completed_at.isoformat() if box.completed_at else None,
                "expected_ecu_count": box.expected_ecu_count,
                "learned_count": box.learned_count or 0,
                # ECU status breakdown
                "total_ecus": b_total,
                "success_ecus": b_success,
                "failed_ecus": b_failed,
                "rework_pending_ecus": b_rework,
                "flashing_ecus": b_flashing,
                "learned_ecus": b_learned,
                # Time metrics
                "avg_flash_time_seconds": b_avg_time,
                "max_flash_time_seconds": b_max_time,
                "min_flash_time_seconds": b_min_time,
                "total_time_seconds": b_total_time,
                # Attempt metrics
                "total_attempts": b_attempt_count,
                "success_attempts": b_success_attempts,
                "failed_attempts": b_failed_attempts,
                # Rates
                "failure_rate": b_fail_rate,
                "completion_rate": round((b_success / b_total) * 100.0, 2) if b_total > 0 else 0.0,
            }
            boxes_kpi.append(box_kpi)

        # ----- station timeline (flash duration over time per station) ----
        station_timeline: Dict[str, List[Dict[str, Any]]] = {}
        for a in sorted(all_attempts, key=lambda x: x.ended_at or datetime.min):
            if (
                a.result in ("success", "failed")
                and a.ended_at is not None
                and a.duration_seconds is not None
            ):
                sname = station_map.get(a.station_id, "Unknown") if a.station_id else "Unknown"
                station_timeline.setdefault(sname, []).append({
                    "time": a.ended_at.isoformat(),
                    "duration": round(a.duration_seconds, 1),
                    "result": a.result,
                })

        # ----- assemble result dict ---------------------------------------
        return {
            "session_id": str(session_id),
            "session_name": session.name,
            "session_status": session.status,
            "target_sw_version": session.target_sw_version,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "closed_at": session.closed_at.isoformat() if session.closed_at else None,
            # Box counts
            "total_boxes": total_boxes,
            "completed_boxes": completed_boxes,
            "blocked_boxes": blocked_boxes,
            "in_progress_boxes": in_progress_boxes,
            "pending_boxes": pending_boxes,
            "learning_boxes": learning_boxes,
            # ECU counts
            "total_ecus": total_ecus,
            "success_ecus": success_ecus,
            "failed_ecus": failed_ecus,
            "flashing_ecus": flashing_ecus,
            "rework_pending_ecus": rework_pending_ecus,
            "learned_ecus": learned_ecus,
            # Rates
            "overall_failure_rate": overall_failure_rate,
            "overall_completion_rate": (
                round((success_ecus / total_ecus) * 100.0, 2) if total_ecus > 0 else 0.0
            ),
            # Flash attempt aggregates
            "total_flash_attempts": total_flash_attempts,
            "avg_flash_time_seconds": avg_flash_time,
            "max_flash_time_seconds": max_flash_time,
            "min_flash_time_seconds": min_flash_time,
            # Per-box breakdown
            "boxes": boxes_kpi,
            # Station flash speed timeline
            "station_timeline": station_timeline,
        }
