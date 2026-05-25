"""
账号管理服务
"""
import hashlib
import secrets
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models import AdminUser, OperationLog
from typing import Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def _hash_password(password: str, salt: str = "") -> str:
    """SHA256 密码哈希"""
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _verify_password(password: str, password_hash: str, salt: str = "") -> bool:
    """验证密码"""
    return _hash_password(password, salt) == password_hash


class AuthService:

    @staticmethod
    def create_user(db: Session, username: str, password: str, role: str = "operator",
                    real_name: str = "", email: str = "", phone: str = "",
                    permissions: str = "device_manage,group_manage,inspection_manage,backup_manage,ai_manage") -> AdminUser:
        """创建管理账号"""
        # 检查用户名是否已存在
        existing = db.query(AdminUser).filter(AdminUser.username == username).first()
        if existing:
            raise ValueError(f"用户名 '{username}' 已存在")

        user = AdminUser(
            username=username,
            password_hash=_hash_password(password),
            role=role,
            real_name=real_name,
            email=email,
            phone=phone,
            permissions=permissions,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate(db: Session, username: str, password: str) -> Optional[AdminUser]:
        """验证登录"""
        user = db.query(AdminUser).filter(
            AdminUser.username == username,
            AdminUser.is_active == True,
        ).first()
        if not user:
            return None
        if not _verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[AdminUser]:
        return db.query(AdminUser).filter(AdminUser.id == user_id).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[AdminUser]:
        return db.query(AdminUser).filter(AdminUser.username == username).first()

    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100,
                  keyword: str = None, role: str = None) -> List[AdminUser]:
        query = db.query(AdminUser)
        if keyword:
            query = query.filter(
                or_(
                    AdminUser.username.contains(keyword),
                    AdminUser.real_name.contains(keyword),
                )
            )
        if role:
            query = query.filter(AdminUser.role == role)
        return query.order_by(AdminUser.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_user(db: Session, user_id: int, **kwargs) -> Optional[AdminUser]:
        user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
        if not user:
            return None

        # 如果更新密码
        if "password" in kwargs and kwargs["password"]:
            kwargs["password_hash"] = _hash_password(kwargs.pop("password"))

        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete_user(db: Session, user_id: int) -> bool:
        user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
        if not user:
            return False
        # 不允许删除最后一个 admin
        if user.role == "admin":
            admin_count = db.query(AdminUser).filter(AdminUser.role == "admin", AdminUser.is_active == True).count()
            if admin_count <= 1:
                raise ValueError("不能删除最后一个管理员账号")
        db.delete(user)
        db.commit()
        return True

    @staticmethod
    def to_dict(user: AdminUser) -> dict:
        """转为字典（不含密码）"""
        return {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "real_name": user.real_name,
            "email": user.email,
            "phone": user.phone,
            "is_active": user.is_active,
            "permissions": user.permissions,
            "last_login_time": user.last_login_time.isoformat() if user.last_login_time else None,
            "last_login_ip": user.last_login_ip,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        }

    @staticmethod
    def init_default_admin(db: Session):
        """初始化默认 admin 账号"""
        existing = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        if not existing:
            user = AdminUser(
                username="admin",
                password_hash=_hash_password("admin"),
                role="admin",
                real_name="系统管理员",
                permissions="device_manage,group_manage,inspection_manage,backup_manage,ai_manage,system_manage",
            )
            db.add(user)
            db.commit()
            logger.info("默认 admin 账号已创建")
