"""
ГИМИФИКАЦИЯ — расчёт опыта (XP) и уровней.

Принципы:
- За каждую тренировку начисляется XP.
- Больше вес / объём (вес×повторы×подходы) → больше XP.
- Больше подходов и повторов → больше XP.
- Побит личный рекорд по упражнению → бонус XP.
- Набрав достаточно XP, пользователь повышает уровень.
- Уровень растёт нелинейно: каждый следующий требует больше XP.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional

# --- Константы баланса (легко настраивать) ---
BASE_XP = 50                  # базовый опыт за завершённую тренировку
VOLUME_XP_RATE = 0.25         # XP за 1 кг общего объёма
VOLUME_XP_CAP = 500           # потолок XP за объём в одной тренировке
SETS_XP = 5                   # XP за каждый подход
REPS_XP = 1                   # XP за каждое повторение
REPS_XP_CAP = 150             # потолок XP за повторения
PR_BONUS_XP = 100             # бонус за личный рекорд по упражнению


@dataclass
class ExerciseInput:
    name: str
    weight: Optional[float] = None
    reps: Optional[int] = None
    sets_count: Optional[int] = None


def calculate_workout_xp(exercises: List[ExerciseInput], pr_count: int = 0) -> int:
    """
    Рассчитывает XP за тренировку.

    exercises — список упражнений с весом/повторами/подходами.
    pr_count  — сколько личных рекордов побито в этой тренировке.
    """
    volume_xp = 0.0
    sets_xp = 0
    reps_xp = 0

    for ex in exercises:
        weight = float(ex.weight or 0)
        reps = int(ex.reps or 0)
        sets = int(ex.sets_count or 0)

        volume = weight * reps * sets
        volume_xp += volume * VOLUME_XP_RATE
        sets_xp += sets * SETS_XP
        reps_xp += reps * REPS_XP

    volume_xp = min(volume_xp, VOLUME_XP_CAP)
    reps_xp = min(reps_xp, REPS_XP_CAP)
    pr_xp = pr_count * PR_BONUS_XP

    total = BASE_XP + volume_xp + sets_xp + reps_xp + pr_xp
    return max(0, int(round(total)))


def _xp_threshold(level: int) -> int:
    """Сколько XP нужно пройти, находясь на уровне `level`, чтобы перейти на следующий."""
    # нелинейный рост: 200 * level^1.4
    return max(100, int(round(200 * (level ** 1.4))))


@dataclass
class LevelInfo:
    level: int
    total_xp: int
    xp_in_level: int
    xp_for_next: int
    progress_pct: float


def level_info(total_xp: int) -> LevelInfo:
    """
    По суммарному XP возвращает информацию об уровне:
    - текущий уровень
    - сколько XP уже пройдено в текущем уровне
    - сколько нужно до следующего уровня
    - процент прогресса (0..100)
    """
    if total_xp < 0:
        total_xp = 0
    level = 1
    remaining = total_xp
    while True:
        threshold = _xp_threshold(level)
        if remaining >= threshold:
            remaining -= threshold
            level += 1
        else:
            break
    threshold = _xp_threshold(level)
    progress = round(remaining / threshold * 100, 1) if threshold else 100.0
    return LevelInfo(
        level=level,
        total_xp=total_xp,
        xp_in_level=remaining,
        xp_for_next=threshold,
        progress_pct=progress,
    )


# --- Названия уровней (звания) ---
LEVEL_TITLES = [
    (1, "Новичок"),
    (3, "Любитель"),
    (5, "Спортсмен"),
    (8, "Атлет"),
    (12, "Профессионал"),
    (16, "Мастер"),
    (20, "Чемпион"),
    (25, "Легенда"),
]


def level_title(level: int) -> str:
    title = LEVEL_TITLES[0][1]
    for threshold, name in LEVEL_TITLES:
        if level >= threshold:
            title = name
    return title


def level_info_dict(total_xp: int) -> dict:
    """Удобный словарь для API/JSON."""
    info = level_info(total_xp)
    return {
        "level": info.level,
        "title": level_title(info.level),
        "total_xp": info.total_xp,
        "xp_in_level": info.xp_in_level,
        "xp_for_next": info.xp_for_next,
        "progress_pct": info.progress_pct,
    }
