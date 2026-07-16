"""
Еженедельный трекинг: вес, калории, БЖУ, шаги, вода, активность.
Тренер задаёт цели, клиент вводит фактические значения.
Автоматический расчёт прогресса/регресса.
"""
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, Float, String, Text, Date, DateTime, ForeignKey
from pydantic import BaseModel

from database import Base, engine, get_db
import models
from auth import get_current_user, require_trainer

router = APIRouter(prefix="/api/weekly", tags=["weekly"])


# ======================= МОДЕЛЬ =======================

class WeeklyCheckIn(Base):
    __tablename__ = "weekly_checkins"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    week_number = Column(Integer, nullable=False)
    check_date = Column(Date, nullable=False, default=date.today)

    # Фактический вес (вводит клиент)
    weight = Column(Float, nullable=True)

    # Цели (задаёт тренер)
    target_calories = Column(Integer, nullable=True)
    target_protein = Column(Float, nullable=True)
    target_fat = Column(Float, nullable=True)
    target_carbs = Column(Float, nullable=True)
    target_steps = Column(Integer, nullable=True)
    target_water = Column(Float, nullable=True)
    target_sleep = Column(Float, nullable=True)

    # Фактические значения (вводит клиент)
    actual_calories = Column(Integer, nullable=True)
    actual_protein = Column(Float, nullable=True)
    actual_fat = Column(Float, nullable=True)
    actual_carbs = Column(Float, nullable=True)
    actual_steps = Column(Integer, nullable=True)
    actual_water = Column(Float, nullable=True)
    actual_sleep = Column(Float, nullable=True)
    actual_activity = Column(Text, nullable=True)

    # Дополнительно
    nutrition_menu_url = Column(String(500), nullable=True)
    trainer_notes = Column(Text, nullable=True)

    # Вычисляемые поля
    progress_status = Column(String(30), nullable=True)
    weight_delta = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# Миграции: новые колонки
from sqlalchemy import text as _text
for _col, _type in [("target_sleep", "REAL"), ("actual_sleep", "REAL")]:
    try:
        with engine.connect() as conn:
            conn.execute(_text(f"ALTER TABLE weekly_checkins ADD COLUMN {_col} {_type}"))
            conn.commit()
    except Exception:
        pass


# ======================= PYDANTIC =======================

class CheckInCreate(BaseModel):
    check_date: Optional[str] = None
    target_calories: Optional[int] = None
    target_protein: Optional[float] = None
    target_fat: Optional[float] = None
    target_carbs: Optional[float] = None
    target_steps: Optional[int] = None
    target_water: Optional[float] = None
    target_sleep: Optional[float] = None
    nutrition_menu_url: Optional[str] = None
    trainer_notes: Optional[str] = None


class TargetsUpdate(BaseModel):
    target_calories: Optional[int] = None
    target_protein: Optional[float] = None
    target_fat: Optional[float] = None
    target_carbs: Optional[float] = None
    target_steps: Optional[int] = None
    target_water: Optional[float] = None
    target_sleep: Optional[float] = None
    nutrition_menu_url: Optional[str] = None
    trainer_notes: Optional[str] = None


class ActualsUpdate(BaseModel):
    weight: Optional[float] = None
    actual_calories: Optional[int] = None
    actual_protein: Optional[float] = None
    actual_fat: Optional[float] = None
    actual_carbs: Optional[float] = None
    actual_steps: Optional[int] = None
    actual_water: Optional[float] = None
    actual_sleep: Optional[float] = None
    actual_activity: Optional[str] = None


# ======================= ХЕЛПЕРЫ =======================

def _serialize(ci: WeeklyCheckIn) -> dict:
    return {
        "id": ci.id,
        "client_id": ci.client_id,
        "week_number": ci.week_number,
        "check_date": str(ci.check_date) if ci.check_date else None,
        "weight": ci.weight,
        "target_calories": ci.target_calories,
        "target_protein": ci.target_protein,
        "target_fat": ci.target_fat,
        "target_carbs": ci.target_carbs,
        "target_steps": ci.target_steps,
        "target_water": ci.target_water,
        "target_sleep": ci.target_sleep,
        "actual_calories": ci.actual_calories,
        "actual_protein": ci.actual_protein,
        "actual_fat": ci.actual_fat,
        "actual_carbs": ci.actual_carbs,
        "actual_steps": ci.actual_steps,
        "actual_water": ci.actual_water,
        "actual_sleep": ci.actual_sleep,
        "actual_activity": ci.actual_activity,
        "nutrition_menu_url": ci.nutrition_menu_url,
        "trainer_notes": ci.trainer_notes,
        "progress_status": ci.progress_status,
        "weight_delta": ci.weight_delta,
        "created_at": str(ci.created_at) if ci.created_at else None,
    }


def _calc_progress(db: Session, ci: WeeklyCheckIn, client: models.Client):
    """Рассчитывает progress_status и weight_delta для записи."""
    prev = db.query(WeeklyCheckIn).filter(
        WeeklyCheckIn.client_id == ci.client_id,
        WeeklyCheckIn.week_number == ci.week_number - 1,
    ).first()

    if not prev:
        ci.progress_status = "first"
        ci.weight_delta = None
        return

    # Разница веса
    if ci.weight is not None and prev.weight is not None:
        ci.weight_delta = round(ci.weight - prev.weight, 2)
    else:
        ci.weight_delta = None

    goal = (client.goal or "").lower()
    wd = ci.weight_delta

    # Базовая оценка по весу и цели
    if wd is not None:
        if "похуд" in goal or "снижен" in goal or "сбит" in goal:
            if wd <= -0.1:
                base = "progress"
            elif wd >= 0.3:
                base = "regression"
            else:
                base = "stable"
        elif "набор" in goal or "масс" in goal or "вес" in goal:
            if wd >= 0.1:
                base = "progress"
            elif wd <= -0.3:
                base = "regression"
            else:
                base = "stable"
        else:
            base = "stable"
    else:
        base = "stable"

    # Корректировка по шагам
    if ci.actual_steps and prev.actual_steps:
        if ci.actual_steps > prev.actual_steps * 1.05:
            if base == "stable":
                base = "progress"
        elif ci.actual_steps < prev.actual_steps * 0.8:
            if base == "stable":
                base = "regression"

    # Проверка повторного регресса (2 предыдущие недели — регресс)
    if base == "regression" and ci.week_number >= 3:
        prev2 = db.query(WeeklyCheckIn).filter(
            WeeklyCheckIn.client_id == ci.client_id,
            WeeklyCheckIn.week_number == ci.week_number - 2,
        ).first()
        if prev and prev2 and prev.progress_status in ("regression", "repeated_regression") \
           and prev2.progress_status in ("regression", "repeated_regression"):
            base = "repeated_regression"

    ci.progress_status = base


# ======================= ЭНДПОИНТЫ ТРЕНЕРА =======================

@router.get("/{client_id}")
def list_checkins(client_id: int,
                  current=Depends(require_trainer),
                  db: Session = Depends(get_db)):
    """Список всех еженедельных записей клиента."""
    items = db.query(WeeklyCheckIn).filter(
        WeeklyCheckIn.client_id == client_id,
    ).order_by(WeeklyCheckIn.week_number.asc()).all()
    return [_serialize(c) for c in items]


@router.post("/{client_id}")
def create_checkin(client_id: int,
                   body: CheckInCreate,
                   current=Depends(require_trainer),
                   db: Session = Depends(get_db)):
    """Создать новую неделю (тренер задаёт цели)."""
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(404, "Клиент не найден")

    max_week = db.query(WeeklyCheckIn).filter(
        WeeklyCheckIn.client_id == client_id,
    ).count()

    ci = WeeklyCheckIn(
        client_id=client_id,
        week_number=max_week + 1,
        check_date=date.fromisoformat(body.check_date) if body.check_date else date.today(),
        target_calories=body.target_calories,
        target_protein=body.target_protein,
        target_fat=body.target_fat,
        target_carbs=body.target_carbs,
        target_steps=body.target_steps,
        target_water=body.target_water,
        nutrition_menu_url=body.nutrition_menu_url,
        trainer_notes=body.trainer_notes,
    )
    db.add(ci)
    db.flush()
    _calc_progress(db, ci, client)
    db.commit()
    db.refresh(ci)
    return _serialize(ci)


@router.put("/{checkin_id}/targets")
def update_targets(checkin_id: int,
                   body: TargetsUpdate,
                   current=Depends(require_trainer),
                   db: Session = Depends(get_db)):
    """Обновить цели (тренер)."""
    ci = db.query(WeeklyCheckIn).get(checkin_id)
    if not ci:
        raise HTTPException(404, "Запись не найдена")

    data = body.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(ci, k, v)

    client = db.query(models.Client).get(ci.client_id)
    _calc_progress(db, ci, client)
    db.commit()
    db.refresh(ci)
    return _serialize(ci)


@router.get("/{client_id}/progress")
def progress_summary(client_id: int,
                     current=Depends(require_trainer),
                     db: Session = Depends(get_db)):
    """Сводка прогресса по неделям."""
    items = db.query(WeeklyCheckIn).filter(
        WeeklyCheckIn.client_id == client_id,
    ).order_by(WeeklyCheckIn.week_number.asc()).all()

    total_weeks = len(items)
    progress_count = sum(1 for c in items if c.progress_status == "progress")
    regression_count = sum(1 for c in items if c.progress_status in ("regression", "repeated_regression"))

    first_weight = next((c.weight for c in items if c.weight is not None), None)
    last_weight = next((c.weight for c in reversed(items) if c.weight is not None), None)
    total_weight_delta = round(last_weight - first_weight, 2) if first_weight and last_weight else None

    return {
        "total_weeks": total_weeks,
        "progress_count": progress_count,
        "regression_count": regression_count,
        "first_weight": first_weight,
        "last_weight": last_weight,
        "total_weight_delta": total_weight_delta,
        "weeks": [_serialize(c) for c in items],
    }


# ======================= ЭНДПОИНТЫ КЛИЕНТА =======================

@router.get("/my/list")
def my_checkins(current=Depends(get_current_user),
                db: Session = Depends(get_db)):
    """Список своих еженедельных записей (клиент)."""
    if current["role"] != "client":
        raise HTTPException(403, "Только для клиента")
    items = db.query(WeeklyCheckIn).filter(
        WeeklyCheckIn.client_id == current["user_id"],
    ).order_by(WeeklyCheckIn.week_number.asc()).all()
    return [_serialize(c) for c in items]


@router.put("/my/{checkin_id}")
def update_my_actuals(checkin_id: int,
                      body: ActualsUpdate,
                      current=Depends(get_current_user),
                      db: Session = Depends(get_db)):
    """Клиент обновляет фактические значения. Авто-расчёт прогресса."""
    if current["role"] != "client":
        raise HTTPException(403, "Только для клиента")

    ci = db.query(WeeklyCheckIn).get(checkin_id)
    if not ci:
        raise HTTPException(404, "Запись не найдена")
    if ci.client_id != current["user_id"]:
        raise HTTPException(403, "Нет доступа")

    data = body.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(ci, k, v)

    client = db.query(models.Client).get(ci.client_id)
    _calc_progress(db, ci, client)
    db.commit()
    db.refresh(ci)
    return _serialize(ci)
