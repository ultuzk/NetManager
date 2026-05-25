"""
日志管理服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from ..models import OperationLog, ConnectionLog
from typing import Optional, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class LogService:

    # ========== 操作日志 ==========

    @staticmethod
    def add_operation_log(db: Session, user_id: int = None, username: str = "",
                          action: str = "", target_type: str = "", target_id: int = None,
                          target_name: str = "", detail: str = "", ip_address: str = "",
                          result: str = "success", error_message: str = None):
        """记录操作日志"""
        try:
            log = OperationLog(
                user_id=user_id,
                username=username or "system",
                action=action,
                target_type=target_type,
                target_id=target_id,
                target_name=target_name,
                detail=detail,
                ip_address=ip_address,
                result=result,
                error_message=error_message,
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"记录操作日志失败: {e}")
            db.rollback()

    @staticmethod
    def get_operation_logs(db: Session, skip: int = 0, limit: int = 100,
                           user_id: int = None, username: str = None,
                           action: str = None, target_type: str = None,
                           result: str = None, keyword: str = None,
                           start_time: datetime = None, end_time: datetime = None) -> List[OperationLog]:
        query = db.query(OperationLog)
        if user_id:
            query = query.filter(OperationLog.user_id == user_id)
        if username:
            query = query.filter(OperationLog.username.contains(username))
        if action:
            query = query.filter(OperationLog.action == action)
        if target_type:
            query = query.filter(OperationLog.target_type == target_type)
        if result:
            query = query.filter(OperationLog.result == result)
        if keyword:
            query = query.filter(
                or_(
                    OperationLog.username.contains(keyword),
                    OperationLog.target_name.contains(keyword),
                    OperationLog.detail.contains(keyword),
                )
            )
        if start_time:
            query = query.filter(OperationLog.created_at >= start_time)
        if end_time:
            query = query.filter(OperationLog.created_at <= end_time)
        return query.order_by(desc(OperationLog.created_at)).offset(skip).limit(limit).all()

    @staticmethod
    def get_operation_log_count(db: Session, **filters) -> int:
        query = db.query(OperationLog)
        if filters.get("user_id"):
            query = query.filter(OperationLog.user_id == filters["user_id"])
        if filters.get("action"):
            query = query.filter(OperationLog.action == filters["action"])
        if filters.get("result"):
            query = query.filter(OperationLog.result == filters["result"])
        return query.count()

    # ========== 连接日志 ==========

    @staticmethod
    def add_connection_log(db: Session, user_id: int = None, username: str = "",
                           device_id: int = None, device_name: str = "", device_ip: str = "",
                           protocol: str = "", action: str = "connect",
                           command: str = None, result: str = "success",
                           error_message: str = None, duration_seconds: int = None):
        """记录连接日志"""
        try:
            log = ConnectionLog(
                user_id=user_id,
                username=username or "system",
                device_id=device_id,
                device_name=device_name,
                device_ip=device_ip,
                protocol=protocol,
                action=action,
                command=command,
                result=result,
                error_message=error_message,
                duration_seconds=duration_seconds,
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"记录连接日志失败: {e}")
            db.rollback()

    @staticmethod
    def get_connection_logs(db: Session, skip: int = 0, limit: int = 100,
                            user_id: int = None, username: str = None,
                            device_id: int = None, device_name: str = None,
                            action: str = None, result: str = None,
                            keyword: str = None,
                            start_time: datetime = None, end_time: datetime = None) -> List[ConnectionLog]:
        query = db.query(ConnectionLog)
        if user_id:
            query = query.filter(ConnectionLog.user_id == user_id)
        if username:
            query = query.filter(ConnectionLog.username.contains(username))
        if device_id:
            query = query.filter(ConnectionLog.device_id == device_id)
        if device_name:
            query = query.filter(ConnectionLog.device_name.contains(device_name))
        if action:
            query = query.filter(ConnectionLog.action == action)
        if result:
            query = query.filter(ConnectionLog.result == result)
        if keyword:
            query = query.filter(
                or_(
                    ConnectionLog.username.contains(keyword),
                    ConnectionLog.device_name.contains(keyword),
                    ConnectionLog.command.contains(keyword),
                )
            )
        if start_time:
            query = query.filter(ConnectionLog.created_at >= start_time)
        if end_time:
            query = query.filter(ConnectionLog.created_at <= end_time)
        return query.order_by(desc(ConnectionLog.created_at)).offset(skip).limit(limit).all()

    @staticmethod
    def cleanup_old_logs(db: Session, days: int = 90):
        """清理超过指定天数的日志"""
        cutoff = datetime.now() - timedelta(days=days)
        op_deleted = db.query(OperationLog).filter(OperationLog.created_at < cutoff).delete()
        conn_deleted = db.query(ConnectionLog).filter(ConnectionLog.created_at < cutoff).delete()
        db.commit()
        logger.info(f"清理日志: 操作日志 {op_deleted} 条, 连接日志 {conn_deleted} 条")
        return op_deleted + conn_deleted
