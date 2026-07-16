"""Роутер шаблонов тренировок."""
import json
from datetime import date as date_type
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user, require_trainer
import gamification

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _template_to_dict(t: models.WorkoutTemplate) -> dict:
    exs = []
    if t.exercises_json:
        try:
            exs = json.loads(t.exercises_json)
        except (ValueError, TypeError):
            exs = []
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "category": t.category,
        "exercises": exs,
        "created_at": t.created_at,
    }


@router.get("")
def list_templates(current=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    q = db.query(models.WorkoutTemplate)
    if current["role"] == "trainer":
        q = q.filter(
            (models.WorkoutTemplate.created_by_user_id == current["user_id"]) |
            (models.WorkoutTemplate.created_by_user_id.is_(None))
        )
    templates = q.order_by(models.WorkoutTemplate.created_at.desc()).all()
    return [_template_to_dict(t) for t in templates]


@router.post("")
def create_template(payload: schemas.TemplateCreate,
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    tpl = models.WorkoutTemplate(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        exercises_json=json.dumps(
            [e.model_dump() for e in payload.exercises], default=str, ensure_ascii=False
        ),
        created_by_user_id=current["user_id"],
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return _template_to_dict(tpl)


@router.get("/{template_id}")
def get_template(template_id: int,
                 current=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    t = db.query(models.WorkoutTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return _template_to_dict(t)


@router.post("/{template_id}/apply")
def apply_template(template_id: int,
                   body: dict,
                   current=Depends(require_trainer),
                   db: Session = Depends(get_db)):
    """Применить шаблон к одному клиенту — создаёт тренировку с упражнениями."""
    t = db.query(models.WorkoutTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")

    client_id = body.get("client_id")
    training_date = body.get("training_date")
    if not client_id or not training_date:
        raise HTTPException(status_code=422, detail="Укажите client_id и training_date")
    if isinstance(training_date, str):
        training_date = date_type.fromisoformat(training_date)

    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")

    exs = json.loads(t.exercises_json) if t.exercises_json else []
    training = models.Training(
        client_id=client_id,
        training_date=training_date,
        body_weight=body.get("body_weight"),
        comment=t.description,
        well_being=None,
    )
    db.add(training)
    db.flush()

    for i, ex in enumerate(exs):
        db.add(models.Exercise(
            training_id=training.id,
            name=ex.get("name", "Упражнение"),
            weight=ex.get("weight"),
            reps=ex.get("reps"),
            sets_count=ex.get("sets_count"),
            position=i,
        ))

    # Списание оплаченной тренировки
    if client.paid_sessions and client.paid_sessions > 0:
        client.paid_sessions -= 1

    # XP
    ex_inputs = [gamification.ExerciseInput(
        name=e.get("name", ""), weight=e.get("weight"),
        reps=e.get("reps"), sets_count=e.get("sets_count")) for e in exs]
    earned_xp = gamification.calculate_workout_xp(ex_inputs)
    client.xp = (client.xp or 0) + earned_xp
    db.add(models.XpLog(client_id=client.id, training_id=training.id,
                        amount=earned_xp, reason="Тренировка по шаблону"))
    db.add(models.Notification(
        client_id=client.id, title="Новая тренировка",
        message=f"Добавлена тренировка «{t.name}» от {training_date}",
        category="training"))

    db.commit()
    db.refresh(training)
    return {"ok": True, "training_id": training.id, "xp": earned_xp}


@router.post("/{template_id}/apply-bulk")
def apply_template_bulk(template_id: int,
                        body: dict,
                        current=Depends(require_trainer),
                        db: Session = Depends(get_db)):
    """Применить шаблон к нескольким клиентам сразу."""
    t = db.query(models.WorkoutTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")

    client_ids = body.get("client_ids", [])
    training_date = body.get("training_date")
    if not client_ids or not training_date:
        raise HTTPException(status_code=422, detail="Укажите client_ids и training_date")
    if isinstance(training_date, str):
        training_date = date_type.fromisoformat(training_date)

    exs = json.loads(t.exercises_json) if t.exercises_json else []
    results = []

    for cid in client_ids:
        client = db.query(models.Client).get(cid)
        if not client:
            results.append({"client_id": cid, "error": "не найден"})
            continue

        training = models.Training(
            client_id=cid, training_date=training_date,
            comment=t.description, well_being=None,
        )
        db.add(training)
        db.flush()

        for i, ex in enumerate(exs):
            db.add(models.Exercise(
                training_id=training.id,
                name=ex.get("name", "Упражнение"),
                weight=ex.get("weight"),
                reps=ex.get("reps"),
                sets_count=ex.get("sets_count"),
                position=i,
            ))

        if client.paid_sessions and client.paid_sessions > 0:
            client.paid_sessions -= 1

        ex_inputs = [gamification.ExerciseInput(
            name=e.get("name", ""), weight=e.get("weight"),
            reps=e.get("reps"), sets_count=e.get("sets_count")) for e in exs]
        earned_xp = gamification.calculate_workout_xp(ex_inputs)
        client.xp = (client.xp or 0) + earned_xp
        db.add(models.XpLog(client_id=cid, training_id=training.id,
                            amount=earned_xp, reason="Тренировка по шаблону"))
        db.add(models.Notification(
            client_id=cid, title="Новая тренировка",
            message=f"Добавлена тренировка «{t.name}» от {training_date}",
            category="training"))
        results.append({"client_id": cid, "training_id": training.id, "xp": earned_xp})

    db.commit()
    return {"ok": True, "applied": len(results), "results": results}


@router.delete("/{template_id}")
def delete_template(template_id: int,
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    t = db.query(models.WorkoutTemplate).get(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    db.delete(t)
    db.commit()
    return {"ok": True}
