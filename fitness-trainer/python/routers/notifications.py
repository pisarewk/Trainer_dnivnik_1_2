"""Роутер уведомлений."""
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(current=Depends(get_current_user),
                       db: Session = Depends(get_db)):
    q = db.query(models.Notification)
    if current["role"] == "client":
        q = q.filter(models.Notification.client_id == current["user_id"])
    else:
        q = q.filter(models.Notification.user_id == current["user_id"])
    return q.order_by(models.Notification.created_at.desc()).all()


@router.get("/new", response_model=List[schemas.NotificationOut])
def new_notifications(since: str = Query(default=None, description="ISO timestamp"),
                     current=Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Возвращает уведомления, созданные после указанного времени.
    Используется для real-time popup уведомлений."""
    q = db.query(models.Notification)
    if current["role"] == "client":
        q = q.filter(models.Notification.client_id == current["user_id"])
    else:
        q = q.filter(models.Notification.user_id == current["user_id"])
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            if since_dt.tzinfo:
                since_dt = since_dt.replace(tzinfo=None)
            q = q.filter(models.Notification.created_at > since_dt)
        except (ValueError, TypeError):
            pass
    return q.order_by(models.Notification.created_at.desc()).limit(20).all()


@router.get("/unread-count")
def unread_count(current=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    q = db.query(models.Notification).filter(models.Notification.is_read == False)
    if current["role"] == "client":
        q = q.filter(models.Notification.client_id == current["user_id"])
    else:
        q = q.filter(models.Notification.user_id == current["user_id"])
    return {"count": q.count()}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int,
              current=Depends(get_current_user),
              db: Session = Depends(get_db)):
    notif = db.query(models.Notification).get(notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    if current["role"] == "client" and notif.client_id != current["user_id"]:
        raise HTTPException(status_code=403, detail="Нет доступа")
    notif.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(current=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    q = db.query(models.Notification).filter(models.Notification.is_read == False)
    if current["role"] == "client":
        q = q.filter(models.Notification.client_id == current["user_id"])
    else:
        q = q.filter(models.Notification.user_id == current["user_id"])
    q.update({models.Notification.is_read: True})
    db.commit()
    return {"ok": True}
