"""Роутер статистики: рекорды, прогресс упражнений, посещаемость."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user
from routers.trainings import _check_access

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/{client_id}/records", response_model=list[schemas.PersonalRecord])
def personal_records(client_id: int,
                     current=Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Личные рекорды по каждому упражнению (лучший вес, повторы, объём)."""
    _check_access(client_id, current, db)
    rows = (db.query(models.Exercise.name,
                     func.max(models.Exercise.weight).label("w"),
                     func.max(models.Exercise.reps).label("r"))
            .join(models.Training)
            .filter(models.Training.client_id == client_id)
            .group_by(models.Exercise.name)
            .all())

    records = []
    for name, best_w, best_r in rows:
        best_vol_row = (db.query(func.max(models.Exercise.weight *
                                          models.Exercise.reps *
                                          models.Exercise.sets_count))
                        .join(models.Training)
                        .filter(models.Training.client_id == client_id,
                                models.Exercise.name == name)
                        .scalar())
        records.append(schemas.PersonalRecord(
            exercise=name,
            best_weight=best_w,
            best_reps=best_r,
            best_volume=best_vol_row,
        ))
    return records


@router.get("/{client_id}/exercise-progress")
def exercise_progress(client_id: int,
                      exercise: str,
                      current=Depends(get_current_user),
                      db: Session = Depends(get_db)):
    """Прогресс одного упражнения: дата, вес, повторы."""
    _check_access(client_id, current, db)
    rows = (db.query(models.Training.training_date, models.Exercise.weight, models.Exercise.reps)
            .join(models.Exercise)
            .filter(models.Training.client_id == client_id,
                    models.Exercise.name == exercise)
            .order_by(models.Training.training_date.asc())
            .all())
    return [
        {"date": str(r.training_date), "weight": float(r.weight) if r.weight else None,
         "reps": r.reps}
        for r in rows
    ]


@router.get("/{client_id}/weight-progress")
def weight_progress(client_id: int,
                    current=Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Изменение массы тела."""
    _check_access(client_id, current, db)
    rows = (db.query(models.Measurement.measure_date, models.Measurement.weight)
            .filter(models.Measurement.client_id == client_id,
                    models.Measurement.weight.isnot(None))
            .order_by(models.Measurement.measure_date.asc())
            .all())
    return [{"date": str(r.measure_date), "weight": float(r.weight)} for r in rows]


@router.get("/{client_id}/attendance")
def attendance(client_id: int,
               current=Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Посещаемость: тренировок за месяц, год и всего."""
    _check_access(client_id, current, db)
    from datetime import date as _date
    today = _date.today()
    trainings = (db.query(models.Training.training_date)
                 .filter(models.Training.client_id == client_id)
                 .all())
    year_count = sum(1 for (d,) in trainings if d.year == today.year)
    month_count = sum(1 for (d,) in trainings
                      if d.year == today.year and d.month == today.month)
    total = len(trainings)
    return {"month": month_count, "year": year_count, "total": total}


@router.get("/{client_id}/exercise-names")
def exercise_names(client_id: int,
                   current=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Список всех уникальных упражнений клиента."""
    _check_access(client_id, current, db)
    rows = (db.query(models.Exercise.name)
            .join(models.Training)
            .filter(models.Training.client_id == client_id)
            .distinct()
            .order_by(models.Exercise.name)
            .all())
    return [r[0] for r in rows]


@router.get("/{client_id}/exercise-summary")
def exercise_summary(client_id: int,
                     current=Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Сводка прогресса по каждому упражнению: первый/последний/лучший вес, динамика."""
    _check_access(client_id, current, db)
    rows = (db.query(models.Exercise.name,
                     models.Exercise.weight,
                     models.Exercise.reps,
                     models.Exercise.sets_count,
                     models.Training.training_date)
            .join(models.Training)
            .filter(models.Training.client_id == client_id,
                    models.Exercise.weight.isnot(None))
            .order_by(models.Training.training_date.asc())
            .all())

    by_ex = {}
    for name, w, r, s, d in rows:
        if name not in by_ex:
            by_ex[name] = []
        by_ex[name].append({"date": str(d), "weight": float(w) if w else None,
                            "reps": r, "sets": s})

    result = []
    for name, entries in by_ex.items():
        first = entries[0]
        last = entries[-1]
        best = max(entries, key=lambda e: e["weight"] or 0)
        delta = None
        trend = "stable"
        if first["weight"] and last["weight"]:
            delta = round(last["weight"] - first["weight"], 1)
            if delta > 0:
                trend = "up"
            elif delta < 0:
                trend = "down"
        result.append({
            "exercise": name,
            "first_weight": first["weight"],
            "last_weight": last["weight"],
            "best_weight": best["weight"],
            "sessions": len(entries),
            "delta": delta,
            "trend": trend,
            "last_date": last["date"],
        })
    result.sort(key=lambda x: x["sessions"], reverse=True)
    return result
