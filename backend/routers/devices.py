from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..schemas import (
    Device, DeviceCreate, DeviceUpdate, DevicePublic,
    ResponseModel, CLICommandRequest, DeviceImportItem,
    DeviceLogQueryRequest,
)
from ..services.device_service import DeviceService
from ..models import Device as DeviceModel

router = APIRouter(prefix="/api/devices", tags=["设备管理"])


def _device_to_public_dict(device) -> dict:
    """将设备对象转为字典，去掉密码字段，包含多分组信息"""
    d = device.__dict__.copy()
    d.pop("password", None)
    d.pop("_sa_instance_state", None)
    # 多分组信息
    group_ids = [g.id for g in device.groups] if device.groups else []
    group_names = [g.name for g in device.groups] if device.groups else []
    d["group_ids"] = group_ids
    d["group_names"] = group_names
    # 兼容旧字段
    d["group_id"] = group_ids[0] if group_ids else None
    d["group_name"] = group_names[0] if group_names else None
    return d


@router.post("/", response_model=DevicePublic)
def create_device(device: DeviceCreate, db: Session = Depends(get_db)):
    return DeviceService.create_device(db, device)


@router.get("/", response_model=List[DevicePublic])
def get_devices(
    skip: int = 0,
    limit: int = 100,
    group_id: Optional[int] = None,
    keyword: Optional[str] = None,
    device_type: Optional[str] = None,
    device_category: Optional[str] = None,
    ip_address: Optional[str] = None,
    db: Session = Depends(get_db),
):
    devices = DeviceService.get_devices(
        db, skip, limit,
        group_id=group_id,
        keyword=keyword,
        device_type=device_type,
        device_category=device_category,
        ip_address=ip_address,
    )
    return [_device_to_public_dict(d) for d in devices]


@router.get("/export/", response_model=ResponseModel)
def export_devices(db: Session = Depends(get_db)):
    devices = db.query(DeviceModel).all()
    data = []
    for device in devices:
        group_ids = [g.id for g in device.groups] if device.groups else []
        data.append({
            "name": device.name,
            "ip_address": device.ip_address,
            "username": device.username,
            "password": "******",
            "protocol": device.protocol,
            "port": device.port,
            "device_type": device.device_type,
            "device_category": device.device_category,
            "group_ids": ",".join(map(str, group_ids)),
            "description": device.description,
        })
    return ResponseModel(success=True, data=data)


@router.get("/{device_id}/", response_model=DevicePublic)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = DeviceService.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    return _device_to_public_dict(device)


@router.put("/{device_id}/", response_model=DevicePublic)
def update_device(
    device_id: int, device_update: DeviceUpdate, db: Session = Depends(get_db)
):
    device = DeviceService.update_device(db, device_id, device_update)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    return _device_to_public_dict(device)


@router.delete("/{device_id}/", response_model=ResponseModel)
def delete_device(device_id: int, db: Session = Depends(get_db)):
    success = DeviceService.delete_device(db, device_id)
    if not success:
        raise HTTPException(status_code=404, detail="设备不存在")
    return ResponseModel(success=True, message="设备删除成功")


@router.post("/{device_id}/test/", response_model=ResponseModel)
def test_connection(device_id: int, db: Session = Depends(get_db)):
    device = DeviceService.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    result = DeviceService.test_connection(device)
    now = __import__("datetime").datetime.now()
    if result["success"]:
        device.connection_status = "success"
        device.last_latency = result.get("latency")
        device.last_test_time = now
        db.commit()
    else:
        device.connection_status = "failed"
        device.last_test_time = now
        db.commit()
    db.refresh(device)
    # 返回更新后的设备状态，便于前端直接关联
    data = {
        **result,
        "connection_status": device.connection_status,
        "last_latency": device.last_latency,
        "last_test_time": device.last_test_time.isoformat() if device.last_test_time else None,
    }
    return ResponseModel(
        success=result["success"], message=result["message"], data=data
    )


@router.post("/{device_id}/cli/", response_model=ResponseModel)
def execute_cli_command(
    device_id: int, command_data: CLICommandRequest, db: Session = Depends(get_db)
):
    device = DeviceService.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    result = DeviceService.execute_command(device, command_data.command)
    return ResponseModel(
        success=result["success"],
        message=result.get("message", "命令执行成功"),
        data=result,
    )


@router.post("/{device_id}/logs/", response_model=ResponseModel)
def query_device_logs(
    device_id: int,
    log_type: str = Query(default="syslog", description="日志类型: syslog/interface/error/all"),
    lines: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """查询设备日志"""
    device = DeviceService.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    result = DeviceService.query_device_logs(device, log_type, lines)
    return ResponseModel(
        success=result["success"],
        message=result.get("message", "日志查询完成"),
        data=result,
    )


@router.post("/import/", response_model=ResponseModel)
def import_devices(
    devices: List[DeviceImportItem], db: Session = Depends(get_db)
):
    success_count = 0
    fail_count = 0
    errors = []
    for item in devices:
        try:
            DeviceService.create_device(db, item)
            success_count += 1
        except Exception as e:
            fail_count += 1
            errors.append(f"{item.name} ({item.ip_address}): {str(e)}")
    return ResponseModel(
        success=True,
        message=f"导入完成: 成功 {success_count} 条, 失败 {fail_count} 条",
        data={"success_count": success_count, "fail_count": fail_count, "errors": errors},
    )


@router.post("/{device_id}/traceroute/", response_model=ResponseModel)
def execute_traceroute(
    device_id: int,
    target_ip: str = Query(..., description="目标IP地址"),
    db: Session = Depends(get_db),
):
    device = DeviceService.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    result = DeviceService.execute_traceroute(device, target_ip)
    return ResponseModel(
        success=result["success"],
        message=result.get("message", "路由跟踪完成"),
        data=result,
    )
