from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi.responses import PlainTextResponse
from ..database import get_db, engine
from ..schemas import (
    InspectionCommand, InspectionCommandCreate,
    InspectionRecord, ResponseModel, InspectionExecuteRequest,
    InspectionCommandExecuteRequest,
)
from ..services.inspection_service import InspectionService, _execute_single_command_sync, _get_device_ids_for_command
from ..models import Device as DeviceModel, DeviceGroup

router = APIRouter(prefix="/api/inspection", tags=["设备巡检"])


def _run_inspection_background(device_id: int):
    """后台执行巡检（自己管理 db 会话）"""
    from backend.database import SessionLocal
    import logging
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        result = InspectionService.execute_inspection(db, device_id)
        logger.info(f"后台巡检完成: device_id={device_id}, records={len(result)}")
    except Exception as e:
        logger.error(f"后台巡检失败: device_id={device_id}, error={e}")
    finally:
        db.close()


@router.post("/commands/", response_model=InspectionCommand)
def create_command(
    command: InspectionCommandCreate, db: Session = Depends(get_db)
):
    return InspectionService.create_command(db, command)


@router.get("/commands/", response_model=List[InspectionCommand])
def get_commands(
    device_type: Optional[str] = None, db: Session = Depends(get_db)
):
    return InspectionService.get_commands(db, device_type)


@router.get("/commands/{command_id}/", response_model=InspectionCommand)
def get_command(command_id: int, db: Session = Depends(get_db)):
    command = InspectionService.get_command(db, command_id)
    if not command:
        raise HTTPException(status_code=404, detail="命令不存在")
    return command


@router.put("/commands/{command_id}/", response_model=InspectionCommand)
def update_command(
    command_id: int,
    name: Optional[str] = None,
    command: Optional[str] = None,
    device_type: Optional[str] = None,
    description: Optional[str] = None,
    enabled: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if command is not None:
        update_data["command"] = command
    if device_type is not None:
        update_data["device_type"] = device_type
    if description is not None:
        update_data["description"] = description
    if enabled is not None:
        update_data["enabled"] = enabled
    cmd = InspectionService.update_command(db, command_id, **update_data)
    if not cmd:
        raise HTTPException(status_code=404, detail="命令不存在")
    return cmd


@router.delete("/commands/{command_id}/", response_model=ResponseModel)
def delete_command(command_id: int, db: Session = Depends(get_db)):
    success = InspectionService.delete_command(db, command_id)
    if not success:
        raise HTTPException(status_code=404, detail="命令不存在")
    return ResponseModel(success=True, message="命令删除成功")


@router.post("/execute/batch/", response_model=ResponseModel)
def execute_batch_inspection(
    request: InspectionExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    批量巡检执行：支持按设备ID列表、分组ID列表、设备类型、设备类别筛选
    优先级: device_ids > group_ids > device_type/device_category
    """
    device_ids = []
    
    # 1. 直接指定设备ID
    if request.device_ids:
        for did in request.device_ids:
            device = db.query(DeviceModel).filter(DeviceModel.id == did).first()
            if device:
                device_ids.append(did)
    
    # 2. 按分组ID筛选
    elif request.group_ids:
        for gid in request.group_ids:
            group = db.query(DeviceGroup).filter(DeviceGroup.id == gid).first()
            if group:
                for device in group.devices:
                    if device.id not in device_ids:
                        device_ids.append(device.id)
    
    # 3. 按设备类型/类别筛选
    elif request.device_type or request.device_category:
        query = db.query(DeviceModel)
        if request.device_type:
            query = query.filter(DeviceModel.device_type == request.device_type)
        if request.device_category:
            query = query.filter(DeviceModel.device_category == request.device_category)
        devices = query.all()
        device_ids = [d.id for d in devices]
    
    else:
        return ResponseModel(success=False, message="请指定巡检目标：设备ID、分组ID或设备类型")

    if not device_ids:
        return ResponseModel(success=False, message="未找到匹配的设备")

    for did in device_ids:
        background_tasks.add_task(_run_inspection_background, did)

    return ResponseModel(
        success=True,
        message=f"批量巡检任务已提交，共 {len(device_ids)} 台设备",
        data={"device_ids": device_ids, "total": len(device_ids)},
    )


@router.post("/execute/command/{command_id}/", response_model=ResponseModel)
def execute_single_command(
    command_id: int,
    request: InspectionCommandExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """执行单条巡检命令：支持按设备ID、分组ID、设备类型、设备类别筛选"""
    command = InspectionService.get_command(db, command_id)
    if not command:
        raise HTTPException(status_code=404, detail="命令不存在")
    
    # 获取匹配的设备ID列表
    device_ids = _get_device_ids_for_command(
        db, command_id,
        device_ids=request.device_ids,
        group_ids=request.group_ids,
        device_type=request.device_type,
        device_category=request.device_category,
    )
    
    if not device_ids:
        return ResponseModel(success=False, message="未找到匹配的设备")
    
    for did in device_ids:
        background_tasks.add_task(_execute_single_command_sync, did, command_id)
    
    return ResponseModel(
        success=True,
        message=f"命令 [{command.name}] 已提交，共 {len(device_ids)} 台设备",
        data={"command_id": command_id, "command_name": command.name, "device_ids": device_ids, "total": len(device_ids)},
    )


@router.post("/execute/{device_id}/", response_model=ResponseModel)
def execute_inspection(
    device_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    device = db.query(DeviceModel).filter(DeviceModel.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")

    background_tasks.add_task(_run_inspection_background, device_id)

    return ResponseModel(
        success=True,
        message="巡检任务已提交，正在后台执行",
        data={"device_id": device_id},
    )


@router.get("/records/", response_model=List[InspectionRecord])
def get_inspection_records(
    device_id: Optional[int] = None,
    device_type: Optional[str] = None,
    device_category: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    records = InspectionService.get_inspection_records(
        db, device_id=device_id, device_type=device_type,
        device_category=device_category, start_time=start_time,
        end_time=end_time, limit=limit,
    )
    result = []
    for record in records:
        record_dict = record.__dict__.copy()
        record_dict["device_name"] = (
            record.device.name if record.device else "未知"
        )
        record_dict["device_ip"] = (
            record.device.ip_address if record.device else "未知"
        )
        result.append(record_dict)
    return result


@router.get("/export/", response_class=PlainTextResponse)
def export_records(
    device_id: Optional[int] = None,
    device_type: Optional[str] = None,
    device_category: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return InspectionService.export_records(
        db, device_id=device_id, device_type=device_type,
        device_category=device_category, start_time=start_time, end_time=end_time,
    )
