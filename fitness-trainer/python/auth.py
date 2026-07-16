"""
Аутентификация и авторизация на основе JWT.
Роли: trainer (администратор) и client.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from database import get_db
import models

SECRET_KEY = os.environ.get("JWT_SECRET", "fitness-trainer-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 часа

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# bcrypt имеет ограничение 72 байта на пароль — обрезаем явно (традиционное поведение).
_BCRYPT_MAX_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(db: Session, username: str, password: str):
    """Поиск пользователя среди тренеров и клиентов."""
    user = db.query(models.User).filter(models.User.username == username).first()
    if user and verify_password(password, user.password_hash):
        return user, "trainer", None

    client = db.query(models.Client).filter(models.Client.full_name == username).first()
    if client is None:
        client = db.query(models.Client).filter(models.Client.phone == username).first()
    if client and verify_password(password, client.password_hash):
        return client, "client", client.id

    return None, None, None


def get_current_user(token: Optional[str] = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)):
    """Декодирует токен и возвращает объект пользователя + роль."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[int] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
        user_id = int(user_id)
    except (JWTError, ValueError):
        raise credentials_exception

    if role == "trainer":
        user = db.query(models.User).filter(models.User.id == user_id).first()
    else:
        user = db.query(models.Client).filter(models.Client.id == user_id).first()
    if user is None:
        raise credentials_exception
    return {"obj": user, "role": role, "user_id": user_id}


def require_trainer(current=Depends(get_current_user)):
    """Доступ только для тренера."""
    if current["role"] != "trainer":
        raise HTTPException(status_code=403, detail="Доступ только для тренера")
    return current


def require_any(current=Depends(get_current_user)):
    """Доступ для тренера или клиента."""
    return current
