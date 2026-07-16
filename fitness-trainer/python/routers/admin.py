"""Роутер админки — управление тренерами, клиентами, отзывами."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(current=Depends(get_current_user)):
    """Доступ только для главного администратора."""
    if current["role"] != "trainer":
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    user = current["obj"]
    if getattr(user, "username", "") != "admin":
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    return current


@router.get("/trainers")
def list_trainers(current=Depends(require_admin),
                  db: Session = Depends(get_db)):
    trainers = db.query(models.User).filter(models.User.role == "trainer").all()
    return [{
        "id": t.id, "username": t.username, "email": t.email,
        "full_name": t.full_name, "created_at": t.created_at,
        "clients_count": db.query(models.Client).filter(models.Client.user_id == t.id).count(),
    } for t in trainers]


@router.delete("/trainers/{trainer_id}")
def delete_trainer(trainer_id: int,
                   current=Depends(require_admin),
                   db: Session = Depends(get_db)):
    if trainer_id == current["user_id"]:
        raise HTTPException(status_code=400, detail="Нельзя удалить себя")
    t = db.query(models.User).get(trainer_id)
    if not t:
        raise HTTPException(status_code=404, detail="Тренер не найден")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/clients")
def list_all_clients(current=Depends(require_admin),
                     db: Session = Depends(get_db)):
    clients = db.query(models.Client).all()
    return [{
        "id": c.id, "full_name": c.full_name, "phone": c.phone,
        "goal": c.goal, "paid_sessions": c.paid_sessions,
        "xp": c.xp, "created_at": c.created_at,
        "trainings_count": db.query(models.Training).filter(models.Training.client_id == c.id).count(),
    } for c in clients]


@router.delete("/clients/{client_id}")
def delete_any_client(client_id: int,
                      current=Depends(require_admin),
                      db: Session = Depends(get_db)):
    c = db.query(models.Client).get(client_id)
    if not c:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.get("/reviews")
def list_all_reviews_admin(current=Depends(require_admin),
                           db: Session = Depends(get_db)):
    reviews = db.query(models.Review).order_by(models.Review.created_at.desc()).all()
    return [{
        "id": r.id, "author_name": r.author_name, "rating": r.rating,
        "text": r.text, "is_approved": r.is_approved, "created_at": r.created_at,
    } for r in reviews]


@router.delete("/reviews/{review_id}")
def delete_any_review(review_id: int,
                      current=Depends(require_admin),
                      db: Session = Depends(get_db)):
    r = db.query(models.Review).get(review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    db.delete(r)
    db.commit()
    return {"ok": True}
