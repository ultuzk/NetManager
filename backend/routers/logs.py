"""
日志管理路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..schemas import ResponseModel
from ..services.log_service import LogService

router = APIRouter(prefix="/api/logs", tags=["日志管理"])


# ========== 操作日志 ==========

@router.get("/operations/", response_model=ResponseModel)
def get_operation_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    result: Optional[str] = None,
    keyword: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    logs = LogService.get_operation_logs(
        db, skip, limit,
        user_id=user_id, username=username,
        action=action, target_type=target_type,
        result=result, keyword=keyword,
        start_time=start_time, end_time=end_time,
    )
    result_list = []
    for log in logs:
        result_list.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": log.username,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "target_name": log.target_name,
            "detail": log.detail,
            "ip_address": log.ip_address,
            "result": log.result,
            "error_message": log.error_message,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return ResponseModel(success=True, data=result_list)


# ========== 连接日志 ==========

@router.get("/connections/", response_model=ResponseModel)
def get_connection_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    device_id: Optional[int] = None,
    device_name: Optional[str] = None,
    action: Optional[str] = None,
    result: Optional[str] = None,
    keyword: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    logs = LogService.get_connection_logs(
        db, skip, limit,
        user_id=user_id, username=username,
        device_id=device_id, device_name=device_name,
        action=action, result=result, keyword=keyword,
        start_time=start_time, end_time=end_time,
    )
    result_list = []
    for log in logs:
        result_list.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": log.username,
            "device_id": log.device_id,
            "device_name": log.device_name,
            "device_ip": log.device_ip,
            "protocol": log.protocol,
            "action": log.action,
            "command": log.command,
            "result": log.result,
            "error_message": log.error_message,
            "duration_seconds": log.duration_seconds,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return ResponseModel(success=True, data=result_list)


# ========== 日志清理 ==========

@router.post("/cleanup/", response_model=ResponseModel)
def cleanup_logs(days: int = Query(default=90, ge=1, le=365), db: Session = Depends(get_db)):
    count = LogService.cleanup_old_logs(db, days)
    return ResponseModel(success=True, message=f"已清理 {count} 条日志")
