"""
Конфигурация pytest: изолированная тестовая БД (SQLite в памяти),
переопределение зависимостей, фикстуры аутентификации.
"""
import os
import sys
from pathlib import Path

# Добавляем папку python/ в путь импорта
PYTHON_DIR = Path(__file__).resolve().parent.parent / "python"
sys.path.insert(0, str(PYTHON_DIR))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database as db_module
import models
from database import Base, get_db


@pytest.fixture(scope="function")
def db_session():
    """Свежая in-memory SQLite БД для каждого теста (StaticPool = одна БД)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient FastAPI с переопределённой зависимостью БД."""
    from main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------- Фикстуры пользователей ----------

TRAINER_CREDS = {"username": "admin", "password": "Admin12345"}
CLIENT_CREDS = {"username": "Тестов Тест", "password": "Client123"}


@pytest.fixture
def trainer(db_session):
    """Создаёт тренера и возвращает токен."""
    from auth import hash_password
    db_session.add(models.User(
        username="admin", email="admin@test.ru", full_name="Тренер",
        password_hash=hash_password(TRAINER_CREDS["password"]), role="trainer",
    ))
    db_session.commit()
    return TRAINER_CREDS


@pytest.fixture
def trainer_token(client, trainer):
    r = client.post("/api/auth/login", json=TRAINER_CREDS)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def client_user(db_session):
    """Создаёт клиента напрямую в БД."""
    from auth import hash_password
    c = models.Client(
        full_name=CLIENT_CREDS["username"],
        phone="+7 900 000-00-00",
        password_hash=hash_password(CLIENT_CREDS["password"]),
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


@pytest.fixture
def client_token(client, client_user):
    r = client.post("/api/auth/login", json=CLIENT_CREDS)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
