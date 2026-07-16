"""Роутер рейтинга (лидерборд) и опыта."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas
from auth import get_current_user
import gamification

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[schemas.LeaderboardEntry])
def leaderboard(limit: int = 50,
               current=Depends(get_current_user),
               db: Session = Depends(get_db)):
    """
    Рейтинг клиентов по суммарному опыту (XP).
    Сортировка по убыванию XP, затем по количеству тренировок.
    """
    limit = max(1, min(limit, 200))

    # Подсчёт тренировок на клиента
    trainings_count = (db.query(models.Training.client_id.label("cid"),
                               func.count(models.Training.id).label("cnt"))
                       .group_by(models.Training.client_id)
                       .subquery())

    rows = (db.query(models.Client, trainings_count.c.cnt)
            .outerjoin(trainings_count, trainings_count.c.cid == models.Client.id)
            .order_by(models.Client.xp.desc())
            .limit(limit)
            .all())

    result = []
    for rank, (client, cnt) in enumerate(rows, start=1):
        info = gamification.level_info(client.xp or 0)
        result.append(schemas.LeaderboardEntry(
            rank=rank,
            client_id=client.id,
            full_name=client.full_name,
            level=info.level,
            title=gamification.level_title(info.level),
            total_xp=client.xp or 0,
            workouts_count=int(cnt or 0),
        ))
    return result


@router.get("/client/{client_id}")
def client_ranking(client_id: int,
                   current=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Позиция конкретного клиента в рейтинге + информация об уровне."""
    all_clients = (db.query(models.Client)
                   .order_by(models.Client.xp.desc())
                   .all())
    rank = None
    for i, c in enumerate(all_clients, start=1):
        if c.id == client_id:
            rank = i
            break
    client = db.query(models.Client).get(client_id)
    if not client:
        from fastapi import HTTPException
        raise HTTPException(404, "Клиент не найден")
    info = gamification.level_info_dict(client.xp or 0)
    return {
        "rank": rank,
        "total_clients": len(all_clients),
        **info,
    }


@router.get("/client/{client_id}/history", response_model=list[schemas.XpOut])
def xp_history(client_id: int,
               current=Depends(get_current_user),
               db: Session = Depends(get_db)):
    """История начисления XP для клиента."""
    from routers.trainings import _check_access
    _check_access(client_id, current, db)
    logs = (db.query(models.XpLog)
            .filter(models.XpLog.client_id == client_id)
            .order_by(models.XpLog.created_at.desc())
            .all())
    return logs
