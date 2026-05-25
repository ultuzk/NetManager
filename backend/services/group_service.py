from sqlalchemy.orm import Session
from ..models import DeviceGroup, Device
from ..schemas import DeviceGroupCreate
from typing import List, Optional

class GroupService:
    @staticmethod
    def create_group(db: Session, group_data: dict) -> DeviceGroup:
        device_ids = group_data.pop("device_ids", []) or []
        db_group = DeviceGroup(**group_data)
        db.add(db_group)
        db.flush()
        # 关联设备
        if device_ids:
            devices = db.query(Device).filter(Device.id.in_(device_ids)).all()
            db_group.devices = devices
        db.commit()
        db.refresh(db_group)
        return db_group

    @staticmethod
    def get_groups(db: Session) -> List[DeviceGroup]:
        return db.query(DeviceGroup).all()

    @staticmethod
    def get_group(db: Session, group_id: int) -> Optional[DeviceGroup]:
        return db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()

    @staticmethod
    def update_group(db: Session, group_id: int, group_data: dict) -> Optional[DeviceGroup]:
        db_group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not db_group:
            return None
        device_ids = group_data.pop("device_ids", None)
        for key, value in group_data.items():
            if hasattr(db_group, key) and value is not None:
                setattr(db_group, key, value)
        # 更新设备关联
        if device_ids is not None:
            devices = db.query(Device).filter(Device.id.in_(device_ids)).all() if device_ids else []
            db_group.devices = devices
        db.commit()
        db.refresh(db_group)
        return db_group

    @staticmethod
    def delete_group(db: Session, group_id: int) -> bool:
        db_group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not db_group:
            return False
        db_group.devices = []  # 清除多对多关联
        db.delete(db_group)
        db.commit()
        return True

    @staticmethod
    def get_group_with_device_count(db: Session) -> List[dict]:
        groups = db.query(DeviceGroup).all()
        result = []
        for group in groups:
            device_count = len(group.devices)
            result.append({
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "device_count": device_count,
                "created_at": group.created_at,
                "updated_at": group.updated_at
            })
        return result
