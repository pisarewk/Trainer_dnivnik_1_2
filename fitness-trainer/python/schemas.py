"""
Pydantic-схемы для валидации и сериализации данных API.
"""
from datetime import date, datetime, time
from typing import Optional, List
from pydantic import BaseModel, Field
from decimal import Decimal


# ---------------- Уровень / опыт ----------------
class LevelInfo(BaseModel):
    level: int = 1
    title: str = "Новичок"
    total_xp: int = 0
    xp_in_level: int = 0
    xp_for_next: int = 100
    progress_pct: float = 0.0


# ---------------- Авторизация ----------------
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    client_id: Optional[int] = None
    full_name: Optional[str] = None
    level: LevelInfo = LevelInfo()


# ---------------- Упражнения ----------------
class ExerciseBase(BaseModel):
    name: str
    weight: Optional[Decimal] = None
    reps: Optional[int] = None
    sets_count: Optional[int] = None
    pulse_before: Optional[int] = None
    pulse_after: Optional[int] = None
    reserve: Optional[int] = None
    position: Optional[int] = 0


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseOut(ExerciseBase):
    id: int

    class Config:
        from_attributes = True


# ---------------- Тренировки ----------------
class TrainingBase(BaseModel):
    client_id: int
    training_date: date
    training_time: Optional[time] = None
    body_weight: Optional[Decimal] = None
    comment: Optional[str] = None
    well_being: Optional[str] = None


class TrainingCreate(TrainingBase):
    exercises: List[ExerciseCreate] = []


class TrainingOut(TrainingBase):
    id: int
    created_at: datetime
    exercises: List[ExerciseOut] = []
    difficulty: Optional[str] = None
    rating: Optional[int] = None
    sleep_hours: Optional[float] = None
    client_comment: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------- Замеры ----------------
class MeasurementBase(BaseModel):
    client_id: int
    measure_date: date
    shin: Optional[Decimal] = None
    calf: Optional[Decimal] = None
    thigh: Optional[Decimal] = None
    buttocks: Optional[Decimal] = None
    waist: Optional[Decimal] = None
    chest: Optional[Decimal] = None
    arm: Optional[Decimal] = None
    wrist: Optional[Decimal] = None
    weight: Optional[Decimal] = None


class MeasurementCreate(MeasurementBase):
    pass


class MeasurementOut(MeasurementBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Клиенты ----------------
class ClientBase(BaseModel):
    full_name: str
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    card_number: Optional[str] = None
    pulse_zone: Optional[str] = None
    goal: Optional[str] = None
    contraindications: Optional[str] = None
    height: Optional[int] = None


class ClientCreate(ClientBase):
    password: Optional[str] = None


class ClientUpdate(ClientBase):
    full_name: Optional[str] = None
    password: Optional[str] = None


class ClientOut(ClientBase):
    id: int
    created_at: datetime
    xp: int = 0
    paid_sessions: int = 0
    session_price: float = 0

    class Config:
        from_attributes = True


# ---------------- Рейтинг ----------------
class LeaderboardEntry(BaseModel):
    rank: int
    client_id: int
    full_name: str
    level: int
    title: str
    total_xp: int
    workouts_count: int


# ---------------- Опыт ----------------
class XpOut(BaseModel):
    amount: int
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Уведомления ----------------
class NotificationCreate(BaseModel):
    client_id: Optional[int] = None
    user_id: Optional[int] = None
    title: str
    message: str
    category: str = "info"


class NotificationOut(BaseModel):
    id: int
    client_id: Optional[int] = None
    user_id: Optional[int] = None
    title: str
    message: str
    category: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Статистика ----------------
class ExerciseProgress(BaseModel):
    date: date
    weight: Optional[Decimal] = None
    reps: Optional[int] = None


class PersonalRecord(BaseModel):
    exercise: str
    best_weight: Optional[Decimal] = None
    best_reps: Optional[int] = None
    best_volume: Optional[Decimal] = None


# ---------------- Шаблоны тренировок ----------------
class TemplateExercise(BaseModel):
    name: str
    weight: Optional[Decimal] = None
    reps: Optional[int] = None
    sets_count: Optional[int] = None
    notes: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "Общая"
    exercises: List[TemplateExercise] = []


class TemplateOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str
    exercises: List[TemplateExercise] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Отзывы ----------------
class ReviewCreate(BaseModel):
    author_name: str = Field(..., min_length=2, max_length=150)
    rating: int = Field(..., ge=1, le=5)
    text: str = Field(..., min_length=5)


class ReviewOut(BaseModel):
    id: int
    author_name: str
    rating: int
    text: str
    is_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True
