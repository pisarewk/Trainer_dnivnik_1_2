"""Роутер замеров тела."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user
from routers.trainings import _check_access

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


@router.get("", response_model=List[schemas.MeasurementOut])
def list_measurements(client_id: int,
                      current=Depends(get_current_user),
                      db: Session = Depends(get_db)):
    _check_access(client_id, current, db)
    return (db.query(models.Measurement)
            .filter(models.Measurement.client_id == client_id)
            .order_by(models.Measurement.measure_date.asc())
            .all())


@router.post("", response_model=schemas.MeasurementOut)
def create_measurement(payload: schemas.MeasurementCreate,
                       current=Depends(get_current_user),
                       db: Session = Depends(get_db)):
    _check_access(payload.client_id, current, db)
    measure = models.Measurement(**payload.model_dump())
    db.add(measure)
    db.commit()
    db.refresh(measure)
    return measure


@router.delete("/{measurement_id}")
def delete_measurement(measurement_id: int,
                       current=Depends(get_current_user),
                       db: Session = Depends(get_db)):
    measure = db.query(models.Measurement).get(measurement_id)
    if not measure:
        raise HTTPException(status_code=404, detail="Замер не найден")
    _check_access(measure.client_id, current, db)
    db.delete(measure)
    db.commit()
    return {"ok": True}
