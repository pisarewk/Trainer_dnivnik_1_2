"""
SQLAlchemy-модели (ORM).
"""
from datetime import date, datetime, time
from sqlalchemy import (
    Column, Integer, Float, String, Text, Numeric, Boolean, Date, Time,
    DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    """Тренер (администратор)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    full_name = Column(String(150))
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="trainer")
    xp = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Client(Base):
    """Клиент тренера."""
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    full_name = Column(String(150), nullable=False)
    birth_date = Column(Date, nullable=True)
    phone = Column(String(30))
    card_number = Column(String(40))
    password_hash = Column(String(255), nullable=True)
    pulse_zone = Column(String(60))
    goal = Column(Text)
    contraindications = Column(Text)
    paid_sessions = Column(Integer, nullable=False, default=0)
    session_price = Column(Numeric(8, 2), nullable=False, default=0)
    is_archived = Column(Boolean, default=False)
    height = Column(Integer, nullable=True)
    xp = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    trainings = relationship("Training", back_populates="client", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="client", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="client", cascade="all, delete-orphan")


class Training(Base):
    """Тренировка клиента."""
    __tablename__ = "trainings"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    training_date = Column(Date, nullable=False)
    training_time = Column(Time, nullable=True)
    body_weight = Column(Numeric(5, 2))
    comment = Column(Text)
    well_being = Column(String(120))
    difficulty = Column(String(20), nullable=True)
    rating = Column(Integer, nullable=True)
    sleep_hours = Column(Float, nullable=True)
    client_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="trainings")
    exercises = relationship("Exercise", back_populates="training", cascade="all, delete-orphan",
                             order_by="Exercise.position")


class Exercise(Base):
    """Упражнение в тренировке."""
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    training_id = Column(Integer, ForeignKey("trainings.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    weight = Column(Numeric(6, 2))
    reps = Column(Integer)
    sets_count = Column(Integer)
    pulse_before = Column(Integer)
    pulse_after = Column(Integer)
    reserve = Column(Integer)
    position = Column(Integer, default=0)

    training = relationship("Training", back_populates="exercises")


class Measurement(Base):
    """Замеры тела клиента."""
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    measure_date = Column(Date, nullable=False)
    shin = Column(Numeric(5, 1))
    calf = Column(Numeric(5, 1))
    thigh = Column(Numeric(5, 1))
    buttocks = Column(Numeric(5, 1))
    waist = Column(Numeric(5, 1))
    chest = Column(Numeric(5, 1))
    arm = Column(Numeric(5, 1))
    wrist = Column(Numeric(5, 1))
    weight = Column(Numeric(5, 1))
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="measurements")


class Notification(Base):
    """Уведомление для клиента или тренера."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(40), default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="notifications")


class XpLog(Base):
    """Журнал начисления опыта (для истории и рейтинга)."""
    __tablename__ = "xp_log"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=True)
    training_id = Column(Integer, ForeignKey("trainings.id", ondelete="CASCADE"), nullable=True)
    amount = Column(Integer, nullable=False, default=0)
    reason = Column(String(200), default="Тренировка")
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkoutTemplate(Base):
    """Шаблон тренировки — план, который можно применять к нескольким клиентам."""
    __tablename__ = "workout_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(60), default="Общая")
    exercises_json = Column(Text)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Review(Base):
    """Отзыв клиента о тренере/зале."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String(150), nullable=False)
    rating = Column(Integer, nullable=False, default=5)
    text = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TrainerSession(Base):
    """Запись на тренировку (календарь, подтверждение, перенос)."""
    __tablename__ = "trainer_sessions"

    id = Column(Integer, primary_key=True, index=True)
    trainer_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    session_date = Column(Date, nullable=False)
    session_time = Column(Time, nullable=True)
    duration_min = Column(Integer, nullable=False, default=60)
    status = Column(String(20), nullable=False, default="pending")
    price = Column(Numeric(8, 2), default=0)
    note = Column(Text)
    reschedule_request = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Medal(Base):
    """Медаль за достижения/посещаемость."""
    __tablename__ = "medals"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    medal_type = Column(String(60), nullable=False)
    description = Column(Text)
    awarded_date = Column(Date, default=date.today)


class Discount(Base):
    """Накопительная скидка клиента."""
    __tablename__ = "discounts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    percent = Column(Integer, nullable=False, default=0)
    reason = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
