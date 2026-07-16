"""Роутер клиентов."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, engine
import models
import schemas
from auth import hash_password, get_current_user, require_trainer
from security import validate_password_strength

router = APIRouter(prefix="/api/clients", tags=["clients"])

# Миграция: добавляем колонку is_archived если её нет (для существующей БД)
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE clients ADD COLUMN is_archived BOOLEAN DEFAULT 0"))
        conn.commit()
except Exception:
    pass
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE clients ADD COLUMN height INTEGER"))
        conn.commit()
except Exception:
    pass  # Колонка уже существует


@router.get("", response_model=List[schemas.ClientOut])
def list_clients(search: Optional[str] = Query(None),
                 current=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """Список клиентов. Тренер видит всех (кроме архивных), клиент — только себя."""
    q = db.query(models.Client)
    if current["role"] == "trainer":
        q = q.filter((models.Client.is_archived == False) | (models.Client.is_archived == None))
    elif current["role"] == "client":
        q = q.filter(models.Client.id == current["user_id"])
    if search:
        like = f"%{search}%"
        q = q.filter(
            (models.Client.full_name.ilike(like)) |
            (models.Client.phone.ilike(like))
        )
    return q.order_by(models.Client.full_name).all()


@router.post("", response_model=schemas.ClientOut)
def create_client(payload: schemas.ClientCreate,
                  current=Depends(require_trainer),
                  db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"password"})
    if payload.password:
        try:
            validate_password_strength(payload.password)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        data["password_hash"] = hash_password(payload.password)
    client = models.Client(**data)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=schemas.ClientOut)
def get_client(client_id: int,
               current=Depends(get_current_user),
               db: Session = Depends(get_db)):
    if current["role"] == "client" and current["user_id"] != client_id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    return client


@router.put("/{client_id}", response_model=schemas.ClientOut)
def update_client(client_id: int,
                  payload: schemas.ClientUpdate,
                  current=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    if current["role"] == "client" and current["user_id"] != client_id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")

    data = payload.model_dump(exclude_unset=True, exclude={"password"})
    for k, v in data.items():
        setattr(client, k, v)
    if payload.password:
        try:
            validate_password_strength(payload.password)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        client.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}")
def delete_client(client_id: int,
                  current=Depends(require_trainer),
                  db: Session = Depends(get_db)):
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    db.delete(client)
    db.commit()
    return {"ok": True}


@router.post("/archive-bulk")
def archive_clients_bulk(body: dict,
                         current=Depends(require_trainer),
                         db: Session = Depends(get_db)):
    """Массовое архивирование клиентов. Данные клиентов сохраняются,
    но они исчезают из списка тренера."""
    ids = body.get("client_ids", [])
    if not ids:
        raise HTTPException(status_code=422, detail="Не выбраны клиенты")
    archived = 0
    for cid in ids:
        client = db.query(models.Client).get(int(cid))
        if client:
            client.is_archived = True
            archived += 1
    db.commit()
    return {"ok": True, "archived": archived}


@router.put("/{client_id}/profile")
def update_own_profile(client_id: int,
                        payload: schemas.ClientUpdate,
                        current=Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """Клиент самостоятельно редактирует свои данные."""
    if current["role"] != "client" or current["user_id"] != client_id:
        raise HTTPException(status_code=403, detail="Только сам клиент может менять профиль")
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    data = payload.model_dump(exclude_unset=True, exclude={"password"})
    for k, v in data.items():
        setattr(client, k, v)
    if payload.password:
        client.password_hash = hash_password(payload.password)
    db.commit()

    # Уведомление тренеру
    notif = models.Notification(
        user_id=client.user_id,
        title="Профиль обновлён",
        message=f"Клиент {client.full_name} обновил анкетные данные",
        category="profile",
    )
    db.add(notif)
    db.commit()
    return {"ok": True}


@router.put("/{client_id}/sessions")
def set_paid_sessions(client_id: int,
                       body: dict,
                       current=Depends(require_trainer),
                       db: Session = Depends(get_db)):
    """Тренер выставляет количество оплаченных тренировок."""
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    amount = body.get("paid_sessions")
    if amount is None or int(amount) < 0:
        raise HTTPException(status_code=422, detail="Укажите неотрицательное число")
    client.paid_sessions = int(amount)
    db.add(models.Notification(
        client_id=client.id,
        title="Оплаченные тренировки",
        message=f"Ваш баланс тренировок обновлён: {int(amount)}",
        category="sessions",
    ))
    db.commit()
    db.refresh(client)
    return {"ok": True, "paid_sessions": client.paid_sessions}


@router.put("/{client_id}/price")
def set_session_price(client_id: int,
                       body: dict,
                       current=Depends(require_trainer),
                       db: Session = Depends(get_db)):
    """Тренер устанавливает стоимость тренировки для клиента."""
    client = db.query(models.Client).get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    price = body.get("session_price")
    if price is None or float(price) < 0:
        raise HTTPException(status_code=422, detail="Укажите неотрицательную цену")
    client.session_price = float(price)
    db.commit()
    db.refresh(client)
    return {"ok": True, "session_price": float(client.session_price)}
