"""Роутер аналитики: посещаемость, прогресс, отчёты тренера."""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
from auth import require_trainer

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/attendance")
def attendance_report(current=Depends(require_trainer),
                      db: Session = Depends(get_db)):
    """Посещаемость клиентов: кто ходит стабильно, кто пропускает."""
    clients = db.query(models.Client).all()
    result = []
    for c in clients:
        trainings = (db.query(models.Training)
                     .filter(models.Training.client_id == c.id)
                     .order_by(models.Training.training_date.asc())
                     .all())
        total = len(trainings)
        if total == 0:
            result.append({
                "client_id": c.id, "full_name": c.full_name,
                "total_sessions": 0, "last_session_date": None,
                "streak": 0, "attendance_rate": 0,
                "status": "нет данных",
            })
            continue

        # Посещаемость за последние 30 дней
        cutoff = date.today() - timedelta(days=30)
        recent = [t for t in trainings if t.training_date >= cutoff]

        # Серия (streak) — считаем подряд идущие тренировки с интервалом <= 10 дней
        streak = 1
        for i in range(len(trainings) - 1, 0, -1):
            gap = (trainings[i].training_date - trainings[i - 1].training_date).days
            if gap <= 10:
                streak += 1
            else:
                break

        last_date = trainings[-1].training_date if trainings else None
        days_since = (date.today() - last_date).days if last_date else 999

        if days_since <= 7:
            status = "ходит стабильно"
        elif days_since <= 14:
            status = "редко ходит"
        else:
            status = "пропускает"

        result.append({
            "client_id": c.id,
            "full_name": c.full_name,
            "total_sessions": total,
            "recent_30d": len(recent),
            "last_session_date": str(last_date) if last_date else None,
            "days_since_last": days_since if last_date else None,
            "streak": streak,
            "attendance_rate": min(100, round(streak / max(total, 1) * 100)),
            "status": status,
        })
    result.sort(key=lambda x: x["total_sessions"], reverse=True)
    return result


@router.get("/progress")
def progress_report(current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    """Прогресс клиентов: изменение веса, достижение цели."""
    clients = db.query(models.Client).all()
    result = []
    for c in clients:
        measurements = (db.query(models.Measurement)
                        .filter(models.Measurement.client_id == c.id)
                        .order_by(models.Measurement.measure_date.asc())
                        .all())
        trainings = (db.query(models.Training)
                     .filter(models.Training.client_id == c.id).count())

        weight_delta = None
        progress_label = "Стабильно"
        has_progress = False

        if len(measurements) >= 2:
            first_w = measurements[0].weight
            last_w = measurements[-1].weight
            if first_w and last_w:
                weight_delta = round(float(last_w) - float(first_w), 1)
                goal = (c.goal or "").lower()
                if "сниж" in goal or "похуд" in goal or "вес" in goal:
                    if weight_delta < 0:
                        has_progress = True
                        progress_label = f"Снижение веса {weight_delta} кг"
                    else:
                        progress_label = f"Вес +{weight_delta} кг (цель: снижение)"
                elif "масс" in goal or "набор" in goal:
                    if weight_delta > 0:
                        has_progress = True
                        progress_label = f"Набор массы +{weight_delta} кг"
                    else:
                        progress_label = f"Вес {weight_delta} кг (цель: набор)"
                else:
                    progress_label = f"Изменение веса {weight_delta:+.1f} кг"

        result.append({
            "client_id": c.id,
            "full_name": c.full_name,
            "goal": c.goal,
            "sessions_count": trainings,
            "weight_first": float(measurements[0].weight) if measurements and measurements[0].weight else None,
            "weight_last": float(measurements[-1].weight) if measurements and measurements[-1].weight else None,
            "weight_delta": weight_delta,
            "has_progress": has_progress,
            "progress_label": progress_label,
        })
    return result


@router.get("/trainer-report")
def trainer_report(current=Depends(require_trainer),
                   db: Session = Depends(get_db)):
    """Сводный отчёт по работе тренера."""
    total_clients = db.query(models.Client).count()
    month_ago = date.today() - timedelta(days=30)
    sessions_this_month = (db.query(models.Training)
                           .filter(models.Training.training_date >= month_ago)
                           .count())
    total_sessions = db.query(models.Training).count()

    # Сессии по тренерам
    trainers = db.query(models.User).filter(models.User.role == "trainer").all()
    by_trainer = []
    for t in trainers:
        count = (db.query(models.Training)
                 .join(models.Client)
                 .filter(models.Client.user_id == t.id)
                 .count())
        by_trainer.append({"trainer_name": t.full_name or t.username, "sessions_count": count})

    avg_attendance = 0
    att = attendance_report(current, db)
    if att:
        rates = [a.get("attendance_rate", 0) for a in att if a.get("total_sessions", 0) > 0]
        avg_attendance = round(sum(rates) / len(rates), 1) if rates else 0

    return {
        "total_clients": total_clients,
        "total_sessions": total_sessions,
        "sessions_this_month": sessions_this_month,
        "avg_attendance_rate": avg_attendance,
        "sessions_by_trainer": by_trainer,
    }


@router.get("/training-feedback")
def training_feedback(current=Depends(require_trainer),
                      db: Session = Depends(get_db)):
    """Оценки тренировок: сложность, рейтинг, сон по каждому клиенту."""
    clients = db.query(models.Client).filter(
        (models.Client.is_archived == False) | (models.Client.is_archived == None)
    ).all()
    result = []
    for c in clients:
        trainings = db.query(models.Training).filter(
            models.Training.client_id == c.id
        ).all()
        rated = [t for t in trainings if t.rating is not None]
        if not rated:
            continue
        avg_rating = round(sum(t.rating for t in rated) / len(rated), 1)
        sleeps = [t.sleep_hours for t in trainings if t.sleep_hours is not None]
        avg_sleep = round(sum(sleeps) / len(sleeps), 1) if sleeps else None
        diffs = {}
        for t in trainings:
            if t.difficulty:
                diffs[t.difficulty] = diffs.get(t.difficulty, 0) + 1
        result.append({
            "client_id": c.id,
            "client_name": c.full_name,
            "total_trainings": len(trainings),
            "rated_count": len(rated),
            "avg_rating": avg_rating,
            "avg_sleep": avg_sleep,
            "difficulty_counts": diffs,
        })
    # Общие средние
    all_ratings = [r["avg_rating"] for r in result]
    all_sleeps = [r["avg_sleep"] for r in result if r["avg_sleep"]]
    return {
        "clients": result,
        "overall_avg_rating": round(sum(all_ratings) / len(all_ratings), 1) if all_ratings else 0,
        "overall_avg_sleep": round(sum(all_sleeps) / len(all_sleeps), 1) if all_sleeps else 0,
    }
