"""
Расписание тренера: рабочие часы + недельная сетка записей.
"""
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from pydantic import BaseModel

from database import Base, engine, get_db
import models
from auth import get_current_user, require_trainer

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

DAYS_RU = {0: "Пн", 1: "Вт", 2: "Ср", 3: "Чт", 4: "Пт", 5: "Сб", 6: "Вс"}


class TrainerSchedule(Base):
    __tablename__ = "trainer_schedule"
    id = Column(Integer, primary_key=True, index=True)
    trainer_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False, default="09:00")
    end_time = Column(String, nullable=False, default="19:00")
    is_active = Column(Boolean, default=True)


Base.metadata.create_all(bind=engine)


class ScheduleSlot(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str


@router.get("/my")
def get_my_schedule(current=Depends(require_trainer), db: Session = Depends(get_db)):
    rows = db.query(TrainerSchedule).filter(
        TrainerSchedule.trainer_user_id == current["user_id"],
    ).all()
    return [{
        "id": r.id,
        "day_of_week": r.day_of_week,
        "day_name": DAYS_RU.get(r.day_of_week, "?"),
        "start_time": r.start_time,
        "end_time": r.end_time,
        "is_active": r.is_active,
    } for r in rows]


@router.post("/my")
def set_my_schedule(slots: List[ScheduleSlot],
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    db.query(TrainerSchedule).filter(
        TrainerSchedule.trainer_user_id == current["user_id"],
    ).delete()
    for s in slots:
        db.add(TrainerSchedule(
            trainer_user_id=current["user_id"],
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            is_active=True,
        ))
    db.commit()
    return {"ok": True, "saved": len(slots)}


@router.get("/week")
def get_week_schedule(date: Optional[str] = None,
                     current=Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Недельная сетка: дни + занятые слоты с именами клиентов."""
    today = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    days = [monday + timedelta(days=i) for i in range(7)]

    if current["role"] == "trainer":
        trainer_id = current["user_id"]
    else:
        client = db.query(models.Client).get(current["user_id"])
        trainer_id = client.user_id if client else None

    sessions = db.query(models.TrainerSession).filter(
        models.TrainerSession.trainer_user_id == trainer_id,
        models.TrainerSession.session_date >= days[0],
        models.TrainerSession.session_date <= days[6],
        models.TrainerSession.status.in_(["pending", "confirmed"]),
    ).all() if trainer_id else []

    by_day = {}
    for s in sessions:
        d = str(s.session_date)
        client = db.query(models.Client).get(s.client_id)
        by_day.setdefault(d, []).append({
            "id": s.id,
            "time": str(s.session_time)[:5] if s.session_time else None,
            "client_name": client.full_name if client else "?",
            "status": s.status,
            "client_id": s.client_id,
        })

    schedule = db.query(TrainerSchedule).filter(
        TrainerSchedule.trainer_user_id == trainer_id,
    ).all() if trainer_id else []
    work_hours = {}
    for s in schedule:
        work_hours[s.day_of_week] = {"start": s.start_time, "end": s.end_time}

    return {
        "week_start": str(days[0]),
        "week_end": str(days[6]),
        "days": [{
            "date": str(d),
            "day_of_week": d.weekday(),
            "day_name": DAYS_RU.get(d.weekday(), "?"),
            "is_today": d == datetime.now().date(),
            "sessions": sorted(by_day.get(str(d), []), key=lambda x: x["time"] or ""),
        } for d in days],
        "work_hours": work_hours,
    }
