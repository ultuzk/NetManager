from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel, Field
from ..database import get_db
from ..schemas import DeviceGroup, ResponseModel
from ..services.group_service import GroupService
from ..models import Device

router = APIRouter(prefix="/api/groups", tags=["分组管理"])


class GroupCreateRequest(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = ""
    device_ids: Optional[List[int]] = []


class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    device_ids: Optional[List[int]] = None


@router.get("/devices/search/", response_model=ResponseModel)
def search_devices_for_group(
    keyword: Optional[str] = Query(None, description="搜索关键词（名称/IP）"),
    device_type: Optional[str] = Query(None, description="设备类型筛选"),
    device_category: Optional[str] = Query(None, description="设备类别筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """为分组管理提供设备查询接口，支持搜索和筛选"""
    query = db.query(Device)
    if keyword:
        query = query.filter(
            or_(
                Device.name.contains(keyword),
                Device.ip_address.contains(keyword),
            )
        )
    if device_type:
        query = query.filter(Device.device_type == device_type)
    if device_category:
        query = query.filter(Device.device_category == device_category)
    total = query.count()
    devices = query.offset(skip).limit(limit).all()
    result = []
    for d in devices:
        result.append({
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "device_category": d.device_category,
            "connection_status": d.connection_status,
        })
    return ResponseModel(
        success=True,
        data={"total": total, "items": result},
    )


@router.post("/", response_model=ResponseModel)
def create_group(group: GroupCreateRequest, db: Session = Depends(get_db)):
    result = GroupService.create_group(db, group.model_dump())
    return ResponseModel(success=True, message="创建成功", data=_to_dict(result))


@router.get("/", response_model=ResponseModel)
def get_groups(db: Session = Depends(get_db)):
    groups = GroupService.get_group_with_device_count(db)
    return ResponseModel(success=True, data=groups)


@router.get("/{group_id}/", response_model=ResponseModel)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = GroupService.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="分组不存在")
    return ResponseModel(success=True, data=_to_dict(group))


@router.put("/{group_id}/", response_model=ResponseModel)
def update_group(
    group_id: int,
    group: GroupUpdateRequest,
    db: Session = Depends(get_db),
):
    result = GroupService.update_group(db, group_id, group.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="分组不存在")
    return ResponseModel(success=True, message="更新成功", data=_to_dict(result))


@router.delete("/{group_id}/", response_model=ResponseModel)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    success = GroupService.delete_group(db, group_id)
    if not success:
        raise HTTPException(status_code=404, detail="分组不存在")
    return ResponseModel(success=True, message="分组删除成功")


def _to_dict(group) -> dict:
    device_ids = [d.id for d in group.devices] if hasattr(group, "devices") and group.devices else []
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "device_count": len(device_ids),
        "device_ids": device_ids,
        "created_at": group.created_at.isoformat() if group.created_at else None,
        "updated_at": group.updated_at.isoformat() if group.updated_at else None,
    }
