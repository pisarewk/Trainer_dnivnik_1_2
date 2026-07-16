"""Роутер аутентификации."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import gamification
from auth import authenticate_user, create_access_token, get_current_user
from security import validate_password_strength, sanitize_username

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    try:
        username = sanitize_username(payload.username)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    user, role, client_id = authenticate_user(db, username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    user_id = user.id
    full_name = getattr(user, "full_name", None)
    xp = getattr(user, "xp", 0) or 0
    token = create_access_token({"sub": str(user_id), "role": role})
    return schemas.TokenResponse(
        access_token=token,
        role=role,
        user_id=user_id,
        client_id=client_id,
        full_name=full_name,
        level=schemas.LevelInfo(**gamification.level_info_dict(xp)),
    )


@router.post("/register")
def register(payload: dict, db: Session = Depends(get_db)):
    """Регистрация нового клиента (самостоятельно). С проверкой надёжности пароля."""
    full_name = (payload.get("full_name") or "").strip()
    password = payload.get("password") or ""
    phone = payload.get("phone")

    if len(full_name) < 3:
        raise HTTPException(status_code=422, detail="Укажите ФИО (минимум 3 символа)")
    try:
        validate_password_strength(password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if db.query(models.Client).filter(models.Client.full_name == full_name).first():
        raise HTTPException(status_code=409, detail="Клиент с таким ФИО уже существует")

    from auth import hash_password
    client = models.Client(full_name=full_name, phone=phone,
                           password_hash=hash_password(password))
    db.add(client)
    db.commit()
    db.refresh(client)
    return {"ok": True, "client_id": client.id}


@router.get("/me")
def me(current=Depends(get_current_user)):
    obj = current["obj"]
    xp = getattr(obj, "xp", 0) or 0
    result = {
        "role": current["role"],
        "user_id": current["user_id"],
        "full_name": getattr(obj, "full_name", None),
        "level": gamification.level_info_dict(xp),
    }
    if current["role"] == "trainer":
        result["email"] = getattr(obj, "email", None)
        result["username"] = getattr(obj, "username", None)
    if current["role"] == "client":
        result["paid_sessions"] = getattr(obj, "paid_sessions", 0) or 0
    return result


@router.put("/trainer-profile")
def update_trainer_profile(body: dict,
                           current=Depends(get_current_user),
                           db: Session = Depends(get_db)):
    if current["role"] != "trainer":
        raise HTTPException(status_code=403, detail="Только для тренера")
    user = db.query(models.User).get(current["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if body.get("full_name"):
        user.full_name = body["full_name"]
    if body.get("email"):
        user.email = body["email"]
    if body.get("password"):
        from security import validate_password_strength
        try:
            validate_password_strength(body["password"])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        from auth import hash_password
        user.password_hash = hash_password(body["password"])
    db.commit()
    db.refresh(user)
    return {"ok": True, "full_name": user.full_name, "email": user.email}
