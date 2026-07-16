"""Роутер календаря: запись на тренировку, подтверждение, отмена, перенос, заработок."""
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, Column, Integer, String, Boolean

from database import get_db, Base
import models
from auth import get_current_user, require_trainer
from routers.schedule import TrainerSchedule

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


# ========== ЗАПИСИ ==========

@router.get("/sessions")
def list_sessions(status: str = None,
                  current=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """Список записей. Тренер видит все свои, клиент — только свои."""
    q = db.query(models.TrainerSession)
    if current["role"] == "trainer":
        q = q.filter(models.TrainerSession.trainer_user_id == current["user_id"])
    else:
        q = q.filter(models.TrainerSession.client_id == current["user_id"])
    if status:
        q = q.filter(models.TrainerSession.status == status)
    rows = q.order_by(models.TrainerSession.session_date.desc(),
                      models.TrainerSession.session_time.asc()).all()
    result = []
    for s in rows:
        client = db.query(models.Client).get(s.client_id)
        result.append({
            "id": s.id,
            "client_id": s.client_id,
            "client_name": client.full_name if client else "?",
            "client_phone": client.phone if client else None,
            "session_date": str(s.session_date),
            "session_time": str(s.session_time)[:5] if s.session_time else None,
            "duration_min": s.duration_min,
            "status": s.status,
            "price": float(s.price) if s.price else 0,
            "note": s.note,
            "reschedule_request": s.reschedule_request,
            "created_at": str(s.created_at),
        })
    return result


@router.post("/book")
def book_session(body: dict,
                 current=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """Клиент записывается на тренировку (статус pending)."""
    if current["role"] != "client":
        raise HTTPException(status_code=403, detail="Только клиент может записаться")
    client = db.query(models.Client).get(current["user_id"])
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")

    sd = body.get("session_date")
    st = body.get("session_time")
    if not sd:
        raise HTTPException(status_code=422, detail="Укажите дату")

    # Конвертация строк в date/time
    from datetime import date as date_cls, time as time_cls
    if isinstance(sd, str):
        sd = date_cls.fromisoformat(sd)
    if st and isinstance(st, str):
        parts = st.split(":")
        st = time_cls(int(parts[0]), int(parts[1]))

    trainer_id = client.user_id
    if not trainer_id:
        trainer_id = db.query(models.User).filter(models.User.role == "trainer").first().id

    # Проверка: время должно быть в рабочих часах тренера
    if st:
        dow = sd.weekday()
        sched = db.query(TrainerSchedule).filter(
            TrainerSchedule.trainer_user_id == trainer_id,
            TrainerSchedule.day_of_week == dow,
            TrainerSchedule.is_active == True,
        ).first()
        all_count = db.query(TrainerSchedule).filter(
            TrainerSchedule.trainer_user_id == trainer_id,
            TrainerSchedule.is_active == True,
        ).count()
        if all_count and all_count > 0 and not sched:
            days_ru = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
            raise HTTPException(
                status_code=409,
                detail=f"В этот день тренер не работает ({days_ru[dow]})"
            )
        if sched:
            book_hour = st.hour
            start_h = int(sched.start_time.split(":")[0])
            end_h = int(sched.end_time.split(":")[0])
            if book_hour < start_h or book_hour >= end_h:
                days_ru = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
                raise HTTPException(
                    status_code=409,
                    detail=f"В это время тренер не работает. Рабочие часы: {days_ru[dow]} {sched.start_time}–{sched.end_time}"
                )

    session = models.TrainerSession(
        trainer_user_id=trainer_id,
        client_id=current["user_id"],
        session_date=sd,
        session_time=st,
        duration_min=int(body.get("duration_min", 60)),
        status="pending",
        price=client.session_price or 0,
        note=body.get("note"),
    )
    db.add(session)
    db.flush()

    # Уведомление тренеру
    time_txt = " в " + str(st)[:5] if st else ""
    db.add(models.Notification(
        user_id=trainer_id,
        title="Новая запись на тренировку",
        message=f"Клиент {client.full_name} записался на {sd}{time_txt}. Статус: ожидает подтверждения.",
        category="booking",
    ))
    db.commit()
    return {"ok": True, "id": session.id, "status": "pending"}


@router.post("/book-for-client")
def book_for_client(body: dict,
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    """Тренер записывает клиента на тренировку (сразу confirmed).
    Создаёт TrainerSession + Training + уведомление клиенту."""
    client_id = body.get("client_id")
    sd = body.get("session_date")
    st = body.get("session_time")

    if not client_id or not sd:
        raise HTTPException(status_code=422, detail="Укажите клиента и дату")

    client = db.query(models.Client).get(int(client_id))
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")

    from datetime import date as date_cls, time as time_cls
    if isinstance(sd, str):
        sd = date_cls.fromisoformat(sd)
    if st and isinstance(st, str):
        parts = st.split(":")
        st = time_cls(int(parts[0]), int(parts[1]))

    # Проверка: нет ли уже записи на это время
    existing = db.query(models.TrainerSession).filter(
        models.TrainerSession.trainer_user_id == current["user_id"],
        models.TrainerSession.session_date == sd,
        models.TrainerSession.session_time == st,
        models.TrainerSession.status.in_(["pending", "confirmed"]),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="На это время уже есть запись")

    # Создаём запись в расписании
    session = models.TrainerSession(
        trainer_user_id=current["user_id"],
        client_id=int(client_id),
        session_date=sd,
        session_time=st,
        duration_min=60,
        status="confirmed",
        price=client.session_price or 0,
        note=body.get("note"),
    )
    db.add(session)
    db.flush()

    # Создаём тренировку (чтобы появилась в списке тренировок клиента)
    training = models.Training(
        client_id=int(client_id),
        training_date=sd,
        training_time=st,
        comment=body.get("note") or None,
    )
    db.add(training)

    # Уведомление клиенту
    time_txt = " в " + str(st)[:5] if st else ""
    db.add(models.Notification(
        client_id=int(client_id),
        title="Новая тренировка",
        message=f"Тренер записал вас на тренировку {sd}{time_txt}.",
        category="booking",
    ))
    db.commit()
    return {"ok": True, "id": session.id, "status": "confirmed", "training_id": training.id}


@router.put("/{session_id}/confirm")
def confirm_session(session_id: int,
                    current=Depends(require_trainer),
                    db: Session = Depends(get_db)):
    """Тренер подтверждает запись."""
    s = db.query(models.TrainerSession).get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    s.status = "confirmed"
    db.add(models.Notification(
        client_id=s.client_id,
        title="Запись подтверждена",
        message=f"Тренер подтвердил вашу тренировку {s.session_date}" + (f" в {str(s.session_time)[:5]}" if s.session_time else ""),
        category="booking",
    ))
    db.commit()
    return {"ok": True, "status": "confirmed"}


@router.put("/{session_id}/cancel")
def cancel_session(session_id: int,
                   body: dict = None,
                   current=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Отмена записи (тренер или клиент). Уведомление другой стороне."""
    s = db.query(models.TrainerSession).get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    # Проверка доступа
    if current["role"] == "client" and current["user_id"] != s.client_id:
        raise HTTPException(status_code=403, detail="Нет доступа")

    reason = (body or {}).get("reason", "")
    s.status = "cancelled"
    client = db.query(models.Client).get(s.client_id)
    who = "Клиент " + (client.full_name if client else "")
    if current["role"] == "trainer":
        # Уведомление клиенту
        db.add(models.Notification(
            client_id=s.client_id,
            title="Запись отменена",
            message=f"Тренер отменил тренировку {s.session_date}" + (f". Причина: {reason}" if reason else ""),
            category="booking",
        ))
    else:
        # Уведомление тренеру
        db.add(models.Notification(
            user_id=s.trainer_user_id,
            title="Клиент отменил запись",
            message=f"{who} отменил тренировку {s.session_date}" + (f". Причина: {reason}" if reason else ""),
            category="booking",
        ))
    db.commit()
    return {"ok": True, "status": "cancelled"}


@router.put("/{session_id}/reschedule")
def reschedule_session(session_id: int,
                       body: dict,
                       current=Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Запрос переноса записи (клиент запрашивает, тренер подтверждает новым временем)."""
    s = db.query(models.TrainerSession).get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if current["role"] == "client" and current["user_id"] != s.client_id:
        raise HTTPException(status_code=403, detail="Нет доступа")

    if current["role"] == "client":
        # Клиент просит перенос
        req = body.get("request", "")
        s.reschedule_request = req
        s.status = "reschedule"
        client = db.query(models.Client).get(s.client_id)
        db.add(models.Notification(
            user_id=s.trainer_user_id,
            title="Запрос переноса",
            message=f"Клиент {client.full_name if client else ''} просит перенести тренировку {s.session_date}: {req}",
            category="booking",
        ))
    else:
        # Тренер переносит на новое время
        new_date = body.get("session_date")
        new_time = body.get("session_time")
        from datetime import date as date_cls, time as time_cls
        if new_date:
            if isinstance(new_date, str):
                new_date = date_cls.fromisoformat(new_date)
            s.session_date = new_date
        if new_time:
            if isinstance(new_time, str):
                parts = new_time.split(":")
                new_time = time_cls(int(parts[0]), int(parts[1]))
            s.session_time = new_time
        s.reschedule_request = None
        s.status = "confirmed"
        db.add(models.Notification(
            client_id=s.client_id,
            title="Тренировка перенесена",
            message=f"Тренер перенёс тренировку на {s.session_date}" + (f" в {str(s.session_time)[:5]}" if s.session_time else ""),
            category="booking",
        ))
    db.commit()
    return {"ok": True, "status": s.status}


@router.put("/{session_id}/complete")
def complete_session(session_id: int,
                     body: dict = None,
                     current=Depends(require_trainer),
                     db: Session = Depends(get_db)):
    """Тренер отмечает тренировку как проведённую. Можно сразу указать цену."""
    s = db.query(models.TrainerSession).get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if body and body.get("price") is not None:
        s.price = float(body["price"])
    s.status = "completed"
    # Уведомление клиенту
    time_txt = " в " + str(s.session_time)[:5] if s.session_time else ""
    db.add(models.Notification(
        client_id=s.client_id,
        title="Тренировка проведена",
        message=f"Тренер отметил тренировку {s.session_date}{time_txt} как проведённую. Отличная работа!",
        category="training",
    ))
    db.commit()
    return {"ok": True, "status": "completed", "price": float(s.price) if s.price else 0}


@router.put("/{session_id}/price")
def update_session_price(session_id: int,
                         body: dict,
                         current=Depends(require_trainer),
                         db: Session = Depends(get_db)):
    """Тренер меняет цену конкретной тренировки — баланс пересчитывается автоматически."""
    s = db.query(models.TrainerSession).get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    price = body.get("price")
    if price is None or float(price) < 0:
        raise HTTPException(status_code=422, detail="Укажите неотрицательную цену")
    s.price = float(price)
    db.commit()
    # Возвращаем обновлённый баланс
    today = date.today()
    month_start = today.replace(day=1)
    sessions = db.query(models.TrainerSession).filter(
        models.TrainerSession.trainer_user_id == current["user_id"],
        models.TrainerSession.status == "completed",
    ).all()
    month_balance = sum(float(ss.price or 0) for ss in sessions if ss.session_date >= month_start)
    return {"ok": True, "price": float(s.price), "month_balance": round(month_balance, 2)}


# ========== ЗАРАБОТОК ==========

@router.get("/earnings")
def earnings(current=Depends(require_trainer),
             db: Session = Depends(get_db)):
    """Заработок тренера: за час, неделю, месяц, год. Баланс обнуляется каждый месяц."""
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    # Подсчёт по завершённым тренировкам (status=completed) + по созданным тренировкам
    # Используем TrainerSession с status=completed
    sessions = db.query(models.TrainerSession).filter(
        models.TrainerSession.trainer_user_id == current["user_id"],
        models.TrainerSession.status == "completed",
    ).all()

    total_all = sum(float(s.price or 0) for s in sessions)
    total_week = sum(float(s.price or 0) for s in sessions if s.session_date >= week_ago)
    total_month = sum(float(s.price or 0) for s in sessions if s.session_date >= month_start)
    total_year = sum(float(s.price or 0) for s in sessions if s.session_date >= year_start)

    # Часы
    hours_month = sum((s.duration_min or 60) / 60.0 for s in sessions if s.session_date >= month_start)
    per_hour = total_month / hours_month if hours_month > 0 else 0

    # Сессии этого месяца
    month_sessions = [s for s in sessions if s.session_date >= month_start]

    return {
        "today": str(today),
        "week_earnings": round(total_week, 2),
        "month_earnings": round(total_month, 2),
        "year_earnings": round(total_year, 2),
        "total_earnings": round(total_all, 2),
        "per_hour": round(per_hour, 2),
        "hours_month": round(hours_month, 1),
        "month_sessions_count": len(month_sessions),
        "month_balance": round(total_month, 2),
        "month_name": today.strftime("%B"),
    }


@router.get("/available-slots")
def available_slots(d: str,
                    current=Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Свободные слоты на выбранную дату — только в рабочие часы тренера."""
    target_date = date.fromisoformat(d)

    # Найти тренера клиента
    if current["role"] == "client":
        client = db.query(models.Client).get(current["user_id"])
        trainer_id = client.user_id if client else None
    else:
        trainer_id = current["user_id"]

    # Рабочие часы тренера для этого дня недели
    dow = target_date.weekday()
    sched = db.query(TrainerSchedule).filter(
        TrainerSchedule.trainer_user_id == trainer_id,
        TrainerSchedule.day_of_week == dow,
        TrainerSchedule.is_active == True,
    ).first() if trainer_id else None

    all_count = db.query(TrainerSchedule).filter(
        TrainerSchedule.trainer_user_id == trainer_id,
        TrainerSchedule.is_active == True,
    ).count() if trainer_id else 0

    # Занятые слоты
    booked = db.query(models.TrainerSession).filter(
        models.TrainerSession.session_date == target_date,
        models.TrainerSession.status.in_(["pending", "confirmed"]),
    ).all()
    booked_times = set(str(s.session_time)[:5] for s in booked if s.session_time)

    if all_count > 0 and not sched:
        return []

    if sched:
        start_h = int(sched.start_time.split(":")[0])
        end_h = int(sched.end_time.split(":")[0])
    else:
        start_h, end_h = 8, 21

    slots = []
    for hour in range(start_h, end_h):
        time_str = f"{hour:02d}:00"
        slots.append({"time": time_str, "available": time_str not in booked_times})
    return slots
