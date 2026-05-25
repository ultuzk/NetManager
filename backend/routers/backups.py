from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db, engine
from ..schemas import Backup, ResponseModel
from ..services.backup_service import BackupService
from ..models import Device as DeviceModel

router = APIRouter(prefix="/api/backups", tags=["备份管理"])


class BackupRequest(BaseModel):
    device_id: int
    backup_type: str = "running-config"


class BatchBackupRequest(BaseModel):
    device_ids: List[int]
    backup_type: str = "running-config"


def _run_backup_background(device_id: int, backup_type: str):
    """后台执行备份（自己管理 db 会话）"""
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        result = BackupService.execute_backup(db, device_id, backup_type)
        import logging
        logging.getLogger(__name__).info(f"后台备份完成: device_id={device_id}, result={result}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"后台备份失败: device_id={device_id}, error={e}")
    finally:
        db.close()


@router.post("/", response_model=ResponseModel)
def execute_backup(
    req: BackupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    device = db.query(DeviceModel).filter(DeviceModel.id == req.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")

    background_tasks.add_task(_run_backup_background, req.device_id, req.backup_type)

    return ResponseModel(
        success=True,
        message="备份任务已提交，正在后台执行",
        data={"device_id": req.device_id, "backup_type": req.backup_type},
    )


@router.post("/batch/", response_model=ResponseModel)
def execute_batch_backup(
    req: BatchBackupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not req.device_ids:
        raise HTTPException(status_code=400, detail="设备ID列表不能为空")

    valid_ids = []
    for did in req.device_ids:
        device = db.query(DeviceModel).filter(DeviceModel.id == did).first()
        if device:
            valid_ids.append(did)
            background_tasks.add_task(_run_backup_background, did, req.backup_type)

    return ResponseModel(
        success=True,
        message=f"批量备份任务已提交，共 {len(valid_ids)} 台设备",
        data={"device_ids": valid_ids},
    )


@router.get("/", response_model=List[Backup])
def get_backups(
    device_id: Optional[int] = None, db: Session = Depends(get_db)
):
    backups = BackupService.get_backups(db, device_id)
    result = []
    for backup in backups:
        backup_dict = backup.__dict__.copy()
        backup_dict["device_name"] = (
            backup.device.name if backup.device else None
        )
        backup_dict["device_ip"] = (
            backup.device.ip_address if backup.device else None
        )
        result.append(backup_dict)
    return result


@router.get("/{backup_id}/", response_model=Backup)
def get_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = BackupService.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="备份不存在")
    backup_dict = backup.__dict__.copy()
    backup_dict["device_name"] = (
        backup.device.name if backup.device else None
    )
    backup_dict["device_ip"] = (
        backup.device.ip_address if backup.device else None
    )
    return backup_dict


@router.delete("/{backup_id}/", response_model=ResponseModel)
def delete_backup(backup_id: int, db: Session = Depends(get_db)):
    success = BackupService.delete_backup(db, backup_id)
    if not success:
        raise HTTPException(status_code=404, detail="备份不存在")
    return ResponseModel(success=True, message="备份删除成功")


@router.post("/compare/", response_model=ResponseModel)
def compare_backups(
    backup_id1: int = Query(..., description="备份1 ID"),
    backup_id2: int = Query(..., description="备份2 ID"),
    db: Session = Depends(get_db),
):
    result = BackupService.compare_backups(db, backup_id1, backup_id2)
    return ResponseModel(
        success=result["success"],
        message=result.get("message", "比对完成"),
        data=result.get("data"),
    )


@router.post("/{backup_id}/restore/", response_model=ResponseModel)
def restore_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = BackupService.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="备份不存在")
    result = BackupService.restore_backup(db, backup.device_id, backup_id)
    return ResponseModel(success=result["success"], message=result["message"])
