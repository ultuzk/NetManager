from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# 设备-分组多对多关联表
device_group_association = Table(
    'device_group_association',
    Base.metadata,
    Column('device_id', Integer, ForeignKey('devices.id'), primary_key=True),
    Column('group_id', Integer, ForeignKey('device_groups.id'), primary_key=True),
)

# ==================== 账号管理 ====================

class AdminUser(Base):
    __tablename__ = 'admin_users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="operator", comment="admin/operator/viewer")
    real_name = Column(String(50))
    email = Column(String(100))
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    last_login_time = Column(DateTime)
    last_login_ip = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 权限位：device_manage, group_manage, inspection_manage, backup_manage, ai_manage, system_manage
    permissions = Column(Text, default="device_manage,group_manage,inspection_manage,backup_manage,ai_manage")

    operation_logs = relationship("OperationLog", back_populates="user")


# ==================== 日志管理 ====================

class OperationLog(Base):
    __tablename__ = 'operation_logs'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('admin_users.id'))
    username = Column(String(50))
    action = Column(String(50), nullable=False, comment="操作类型: login/logout/create/update/delete/execute/connect等")
    target_type = Column(String(50), comment="操作对象类型: device/group/inspection/backup/account/system等")
    target_id = Column(Integer, comment="操作对象ID")
    target_name = Column(String(100), comment="操作对象名称")
    detail = Column(Text, comment="操作详情")
    ip_address = Column(String(50))
    result = Column(String(20), default="success", comment="success/failed")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("AdminUser", back_populates="operation_logs")


class ConnectionLog(Base):
    __tablename__ = 'connection_logs'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('admin_users.id'))
    username = Column(String(50))
    device_id = Column(Integer, ForeignKey('devices.id'))
    device_name = Column(String(100))
    device_ip = Column(String(15))
    protocol = Column(String(10))
    action = Column(String(20), comment="connect/disconnect/command")
    command = Column(Text, comment="执行的命令")
    result = Column(String(20), default="success")
    error_message = Column(Text)
    duration_seconds = Column(Integer, comment="连接时长(秒)")
    created_at = Column(DateTime, default=datetime.now)


# ==================== 定时备份 ====================

class ScheduledBackup(Base):
    __tablename__ = 'scheduled_backups'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    backup_type = Column(String(50), default="running-config")
    # 执行目标筛选
    device_ids = Column(Text, comment="设备ID列表,逗号分隔,空表示全部")
    group_ids = Column(Text, comment="分组ID列表,逗号分隔")
    device_type = Column(String(20), comment="设备类型筛选")
    device_category = Column(String(20), comment="设备类别筛选")
    # 调度配置
    interval_days = Column(Integer, default=7, comment="备份间隔天数")
    hour = Column(Integer, default=2, comment="执行时间-小时(0-23)")
    minute = Column(Integer, default=0, comment="执行时间-分钟(0-59)")
    enabled = Column(Boolean, default=True)
    last_run_time = Column(DateTime)
    next_run_time = Column(DateTime)
    last_result = Column(String(20))
    last_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# ==================== 设备管理 ====================

class DeviceGroup(Base):
    __tablename__ = 'device_groups'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    devices = relationship("Device", secondary=device_group_association, back_populates="groups")


class Device(Base):
    __tablename__ = 'devices'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    ip_address = Column(String(15), nullable=False)
    username = Column(String(50), nullable=False)
    password = Column(String(100), nullable=False)
    protocol = Column(String(10), default="ssh", comment="ssh/telnet")
    port = Column(Integer, default=22)
    device_type = Column(String(20), default="auto", comment="设备类型")
    device_category = Column(String(20), default="switch", comment="设备类别")
    connection_status = Column(String(20), default="unknown")
    last_latency = Column(Float)
    last_test_time = Column(DateTime)
    last_inspection_time = Column(DateTime)
    password_expire_date = Column(DateTime, comment="密码到期日期")
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    groups = relationship("DeviceGroup", secondary=device_group_association, back_populates="devices")
    inspection_records = relationship("InspectionRecord", back_populates="device")
    backups = relationship("Backup", back_populates="device")


class Backup(Base):
    __tablename__ = 'backups'

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('devices.id'))
    backup_type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")
    file_path = Column(String(255))
    content = Column(Text)
    version = Column(String(20))
    created_at = Column(DateTime, default=datetime.now)

    device = relationship("Device", back_populates="backups")


class AIConfig(Base):
    __tablename__ = 'ai_configs'

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), default="openai")
    api_key = Column(String(255))
    model = Column(String(100), default="gpt-4")
    base_url = Column(String(255), default="https://api.openai.com/v1")
    timeout = Column(Integer, default=30)
    enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class AILogAnalysis(Base):
    __tablename__ = 'ai_log_analyses'

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('devices.id'))
    log_content = Column(Text)
    analysis_result = Column(Text)
    severity = Column(String(20), default="info")
    recommendations = Column(Text)
    created_at = Column(DateTime, default=datetime.now)


class InspectionCommand(Base):
    __tablename__ = 'inspection_commands'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    command = Column(Text, nullable=False)
    device_type = Column(String(20), nullable=False)
    description = Column(Text)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)


class InspectionRecord(Base):
    __tablename__ = 'inspection_records'

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('devices.id'))
    command_id = Column(Integer, ForeignKey('inspection_commands.id'))
    command_name = Column(String(100))
    command_output = Column(Text)
    status = Column(String(20), default="success")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    device = relationship("Device", back_populates="inspection_records")
    command = relationship("InspectionCommand")
