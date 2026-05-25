"""
定时备份路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, Field
from ..database import get_db
from ..schemas import ResponseModel
from ..models import ScheduledBackup
from ..services.log_service import LogService
from datetime import datetime

router = APIRouter(prefix="/api/scheduled-backups", tags=["定时备份"])


# ========== 请求模型 ==========

class ScheduledBackupCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    backup_type: str = Field(default="running-config")
    device_ids: Optional[str] = None
    group_ids: Optional[str] = None
    device_type: Optional[str] = None
    device_category: Optional[str] = None
    interval_days: int = Field(default=7, ge=1, le=365)
    hour: int = Field(default=2, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    enabled: bool = True


class ScheduledBackupUpdateRequest(BaseModel):
    name: Optional[str] = None
    backup_type: Optional[str] = None
    device_ids: Optional[str] = None
    group_ids: Optional[str] = None
    device_type: Optional[str] = None
    device_category: Optional[str] = None
    interval_days: Optional[int] = Field(None, ge=1, le=365)
    hour: Optional[int] = Field(None, ge=0, le=23)
    minute: Optional[int] = Field(None, ge=0, le=59)
    enabled: Optional[bool] = None


# ========== CRUD ==========

@router.post("/", response_model=ResponseModel)
def create_scheduled_backup(request: ScheduledBackupCreateRequest, db: Session = Depends(get_db)):
    schedule = ScheduledBackup(
        name=request.name,
        backup_type=request.backup_type,
        device_ids=request.device_ids,
        group_ids=request.group_ids,
        device_type=request.device_type,
        device_category=request.device_category,
        interval_days=request.interval_days,
        hour=request.hour,
        minute=request.minute,
        enabled=request.enabled,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    LogService.add_operation_log(
        db, username="system", action="create",
        target_type="scheduled_backup", target_id=schedule.id, target_name=schedule.name,
        detail=f"创建定时备份: {schedule.name}, 间隔 {schedule.interval_days} 天",
    )
    return ResponseModel(success=True, message="创建成功", data=_to_dict(schedule))


@router.get("/", response_model=ResponseModel)
def get_scheduled_backups(db: Session = Depends(get_db)):
    schedules = db.query(ScheduledBackup).order_by(ScheduledBackup.created_at.desc()).all()
    return ResponseModel(success=True, data=[_to_dict(s) for s in schedules])


@router.get("/{schedule_id}/", response_model=ResponseModel)
def get_scheduled_backup(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(ScheduledBackup).filter(ScheduledBackup.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="定时备份不存在")
    return ResponseModel(success=True, data=_to_dict(schedule))


@router.put("/{schedule_id}/", response_model=ResponseModel)
def update_scheduled_backup(schedule_id: int, request: ScheduledBackupUpdateRequest, db: Session = Depends(get_db)):
    schedule = db.query(ScheduledBackup).filter(ScheduledBackup.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="定时备份不存在")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(schedule, key) and value is not None:
            setattr(schedule, key, value)

    # 重置下次执行时间
    if "interval_days" in update_data or "hour" in update_data or "minute" in update_data:
        schedule.next_run_time = None

    db.commit()
    db.refresh(schedule)

    LogService.add_operation_log(
        db, username="system", action="update",
        target_type="scheduled_backup", target_id=schedule.id, target_name=schedule.name,
        detail=f"更新定时备份: {schedule.name}",
    )
    return ResponseModel(success=True, message="更新成功", data=_to_dict(schedule))


@router.delete("/{schedule_id}/", response_model=ResponseModel)
def delete_scheduled_backup(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(ScheduledBackup).filter(ScheduledBackup.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="定时备份不存在")
    name = schedule.name
    db.delete(schedule)
    db.commit()

    LogService.add_operation_log(
        db, username="system", action="delete",
        target_type="scheduled_backup", target_id=schedule_id, target_name=name,
        detail=f"删除定时备份: {name}",
    )
    return ResponseModel(success=True, message="删除成功")


@router.post("/{schedule_id}/run/", response_model=ResponseModel)
def run_scheduled_backup_now(schedule_id: int, db: Session = Depends(get_db)):
    """立即执行一次定时备份，返回每台设备的执行结果"""
    from ..services.scheduled_backup_service import get_scheduler
    schedule = db.query(ScheduledBackup).filter(ScheduledBackup.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="定时备份不存在")

    scheduler = get_scheduler()
    run_detail = scheduler._execute_scheduled_backup(db, schedule)

    # 刷新以获取最新状态
    db.refresh(schedule)

    return ResponseModel(
        success=True,
        message=run_detail.get("message", f"定时备份 [{schedule.name}] 执行完成"),
        data={
            "schedule": _to_dict(schedule),
            "run_result": run_detail,
        },
    )


def _to_dict(schedule: ScheduledBackup) -> dict:
    return {
        "id": schedule.id,
        "name": schedule.name,
        "backup_type": schedule.backup_type,
        "device_ids": schedule.device_ids,
        "group_ids": schedule.group_ids,
        "device_type": schedule.device_type,
        "device_category": schedule.device_category,
        "interval_days": schedule.interval_days,
        "hour": schedule.hour,
        "minute": schedule.minute,
        "enabled": schedule.enabled,
        "last_run_time": schedule.last_run_time.isoformat() if schedule.last_run_time else None,
        "next_run_time": schedule.next_run_time.isoformat() if schedule.next_run_time else None,
        "last_result": schedule.last_result,
        "last_message": schedule.last_message,
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }
