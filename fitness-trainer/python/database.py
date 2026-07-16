"""
Конфигурация подключения к базе данных.
По умолчанию SQLite (запуск без установки БД).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./fitness.db")

# Render отдаёт postgres:// — SQLAlchemy ждёт postgresql+psycopg2://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL and DATABASE_URL.startswith("postgresql://") and "+" not in DATABASE_URL.split("://")[0]:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {}
if not DATABASE_URL or DATABASE_URL.startswith("sqlite"):
    DATABASE_URL = "sqlite:///./fitness.db"
    connect_args = {"check_same_thread": False}

# Защита: если URL битый — fallback на SQLite
try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
except Exception:
    DATABASE_URL = "sqlite:///./fitness.db"
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
