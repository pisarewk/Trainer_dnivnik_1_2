"""Роутер тренировок и упражнений."""
from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, engine
import models
import schemas
from auth import get_current_user, require_trainer
import gamification

router = APIRouter(prefix="/api/trainings", tags=["trainings"])

# Миграции: новые колонки
for _col, _type in [("difficulty", "VARCHAR(20)"), ("rating", "INTEGER"), ("sleep_hours", "REAL"), ("client_comment", "TEXT")]:
    try:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE trainings ADD COLUMN {_col} {_type}"))
            conn.commit()
    except Exception:
        pass


def _check_access(client_id: int, current, db: Session):
    if current["role"] == "client" and current["user_id"] != client_id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    return client


@router.get("", response_model=List[schemas.TrainingOut])
def list_trainings(client_id: int,
                   current=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    _check_access(client_id, current, db)
    return (db.query(models.Training)
            .filter(models.Training.client_id == client_id)
            .order_by(models.Training.training_date.desc())
            .all())


@router.post("", response_model=schemas.TrainingOut)
def create_training(payload: schemas.TrainingCreate,
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    client = db.query(models.Client).get(payload.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")

    ex_data = payload.model_dump(exclude={"exercises"})
    training = models.Training(**ex_data)
    db.add(training)
    db.flush()

    # Списание оплаченной тренировки
    if client.paid_sessions is not None and client.paid_sessions > 0:
        client.paid_sessions -= 1
        db.add(models.Notification(
            client_id=client.id,
            title="Тренировка списана",
            message=f"Списана 1 тренировка. Осталось: {client.paid_sessions}",
            category="sessions",
        ))

    for i, ex in enumerate(payload.exercises):
        ex_dict = ex.model_dump()
        ex_dict["position"] = i
        db.add(models.Exercise(training_id=training.id, **ex_dict))

    # Авто-замер веса тела из тренировки → обновляется график веса
    if payload.body_weight is not None:
        existing = (db.query(models.Measurement)
                    .filter(models.Measurement.client_id == client.id,
                            models.Measurement.measure_date == payload.training_date)
                    .first())
        if existing:
            existing.weight = payload.body_weight
        else:
            db.add(models.Measurement(
                client_id=client.id,
                measure_date=payload.training_date,
                weight=payload.body_weight,
            ))

    # Уведомление клиенту
    db.add(models.Notification(
        client_id=client.id,
        title="Новая тренировка",
        message=f"Добавлена тренировка от {payload.training_date.strftime('%d.%m.%Y')}",
        category="training",
    ))

    # Проверка личных рекордов
    pr_count = _check_records(db, client, training)

    # --- Начисление опыта (XP) ---
    ex_inputs = [gamification.ExerciseInput(
        name=e.name, weight=e.weight, reps=e.reps, sets_count=e.sets_count
    ) for e in training.exercises]
    earned_xp = gamification.calculate_workout_xp(ex_inputs, pr_count=pr_count)

    level_before = gamification.level_info(client.xp).level
    client.xp = (client.xp or 0) + earned_xp
    level_after = gamification.level_info(client.xp).level

    db.add(models.XpLog(client_id=client.id, training_id=training.id,
                        amount=earned_xp, reason="Тренировка"))
    db.add(models.Notification(
        client_id=client.id,
        title="Опыт начислен",
        message=f"Вы получили +{earned_xp} XP за тренировку!",
        category="xp",
    ))
    if level_after > level_before:
        db.add(models.Notification(
            client_id=client.id,
            title="Новый уровень!",
            message=f"Поздравляем! Достигнут уровень {level_after} — «{gamification.level_title(level_after)}»",
            category="level",
        ))

    db.commit()
    db.refresh(training)
    return training


@router.get("/{training_id}", response_model=schemas.TrainingOut)
def get_training(training_id: int,
                 current=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    training = db.query(models.Training).get(training_id)
    if not training:
        raise HTTPException(status_code=404, detail="Тренировка не найдена")
    _check_access(training.client_id, current, db)
    return training


@router.delete("/{training_id}")
def delete_training(training_id: int,
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    training = db.query(models.Training).get(training_id)
    if not training:
        raise HTTPException(status_code=404, detail="Тренировка не найдена")
    db.delete(training)
    db.commit()
    return {"ok": True}


@router.post("/{training_id}/comment")
def add_comment(training_id: int,
                body: dict,
                current=Depends(require_trainer),
                db: Session = Depends(get_db)):
    """Комментарий тренера после тренировки — виден клиенту."""
    training = db.query(models.Training).get(training_id)
    if not training:
        raise HTTPException(status_code=404, detail="Тренировка не найдена")
    comment = body.get("comment", "")
    well_being = body.get("well_being")
    training.comment = comment
    if well_being is not None:
        training.well_being = well_being
    db.add(models.Notification(
        client_id=training.client_id,
        title="Комментарий тренера",
        message=comment or "Тренер оставил отметку о тренировке",
        category="comment",
    ))
    db.commit()
    return {"ok": True}


@router.put("/{training_id}/rate")
def rate_training(training_id: int,
                  body: dict,
                  current=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """Клиент оценивает тренировку: сложность, оценка, сон, комментарий."""
    if current["role"] != "client":
        raise HTTPException(status_code=403, detail="Только клиент может оценивать")
    training = db.query(models.Training).get(training_id)
    if not training:
        raise HTTPException(status_code=404, detail="Тренировка не найдена")
    if training.client_id != current["user_id"]:
        raise HTTPException(status_code=403, detail="Нет доступа")

    training.difficulty = body.get("difficulty")
    training.rating = body.get("rating")
    training.sleep_hours = body.get("sleep_hours")
    training.client_comment = body.get("client_comment")

    # Уведомление тренеру
    client = db.query(models.Client).get(training.client_id)
    diff_map = {"easy": "Легко", "medium": "Средне", "hard": "Сложно"}
    diff_txt = diff_map.get(body.get("difficulty"), "")
    rating_txt = f", оценка: {body.get('rating')}/5" if body.get('rating') else ""
    sleep_txt = f", сон: {body.get('sleep_hours')}ч" if body.get('sleep_hours') is not None else ""
    db.add(models.Notification(
        user_id=client.user_id if client else None,
        title="Тренировка оценена",
        message=f"{client.full_name if client else 'Клиент'} оценил тренировку {training.training_date}: {diff_txt}{rating_txt}{sleep_txt}",
        category="training",
    ))
    db.commit()
    return {"ok": True}


def _check_records(db: Session, client: models.Client, training: models.Training) -> int:
    """
    Проверка, не побит ли личный рекорд, создание уведомлений.
    Возвращает количество побитых рекордов (для бонусного XP).
    """
    pr_count = 0
    for ex in training.exercises:
        prev = (db.query(models.Exercise)
                .join(models.Training)
                .filter(models.Training.client_id == client.id,
                        models.Exercise.name == ex.name,
                        models.Exercise.id != ex.id)
                .order_by(models.Exercise.weight.desc())
                .first())
        if ex.weight is not None and (prev is None or prev.weight is None or ex.weight > prev.weight):
            pr_count += 1
            db.add(models.Notification(
                client_id=client.id,
                title="Новый рекорд!",
                message=f"Новый личный рекорд: {ex.name} — {ex.weight} кг",
                category="record",
            ))
    return pr_count
