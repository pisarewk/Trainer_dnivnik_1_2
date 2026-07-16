"""Роутер отзывов."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user, require_trainer

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.get("")
def list_approved_reviews(db: Session = Depends(get_db)):
    """Публичный список одобренных отзывов (без авторизации)."""
    reviews = (db.query(models.Review)
               .filter(models.Review.is_approved == True)
               .order_by(models.Review.created_at.desc())
               .all())
    return [{"id": r.id, "author_name": r.author_name, "rating": r.rating,
             "text": r.text, "created_at": r.created_at} for r in reviews]


@router.get("/all")
def list_all_reviews(current=Depends(require_trainer),
                     db: Session = Depends(get_db)):
    """Все отзывы (включая неодобренные) — для тренера."""
    reviews = db.query(models.Review).order_by(models.Review.created_at.desc()).all()
    return [{"id": r.id, "author_name": r.author_name, "rating": r.rating,
             "text": r.text, "is_approved": r.is_approved,
             "created_at": r.created_at} for r in reviews]


@router.post("")
def create_review(payload: schemas.ReviewCreate,
                  current=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """Создать отзыв (требует авторизации). По умолчанию неодобрен."""
    review = models.Review(
        client_id=current["user_id"] if current["role"] == "client" else None,
        author_name=payload.author_name,
        rating=payload.rating,
        text=payload.text,
        is_approved=False,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"ok": True, "id": review.id, "message": "Отзыв отправлен на модерацию"}


@router.put("/{review_id}/approve")
def approve_review(review_id: int,
                   current=Depends(require_trainer),
                   db: Session = Depends(get_db)):
    r = db.query(models.Review).get(review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    r.is_approved = True
    db.commit()
    return {"ok": True}


@router.delete("/{review_id}")
def delete_review(review_id: int,
                  current=Depends(require_trainer),
                  db: Session = Depends(get_db)):
    r = db.query(models.Review).get(review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Отзыв не найден")
    db.delete(r)
    db.commit()
    return {"ok": True}
