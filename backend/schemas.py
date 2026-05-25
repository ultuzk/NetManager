from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import re

# --- 分组模型 ---

class DeviceGroupBase(BaseModel):
    name: str = Field(..., description="分组名称", max_length=100)
    description: Optional[str] = Field(None, description="分组描述")

class DeviceGroupCreate(DeviceGroupBase):
    pass

class DeviceGroup(DeviceGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime
    device_count: int = Field(0, description="设备数量")

    class Config:
        from_attributes = True

# --- 设备模型 ---

class DeviceBase(BaseModel):
    name: str = Field(..., description="设备名称", max_length=100)
    ip_address: str = Field(..., description="IP地址")
    username: str = Field(..., description="用户名", max_length=50)
    password: str = Field(..., description="密码")
    protocol: str = Field(default="ssh", description="连接协议")
    port: int = Field(default=22, description="端口号", ge=1, le=65535)
    device_type: str = Field(default="auto", description="设备类型")
    device_category: str = Field(default="switch", description="设备类别")
    group_ids: Optional[List[int]] = Field(default=None, description="分组ID列表（支持多个）")
    password_expire_date: Optional[datetime] = Field(None, description="密码到期日期")
    description: Optional[str] = Field(None, description="设备描述")

    @field_validator("ip_address")
    @classmethod
    def validate_ip(cls, v):
        if not re.match(r"^(\d{1,3}\.){3}\d{1,3}$", v):
            raise ValueError("无效的IP地址格式")
        for part in v.split("."):
            if int(part) > 255:
                raise ValueError("无效的IP地址格式")
        return v

    @field_validator("protocol")
    @classmethod
    def validate_protocol(cls, v):
        if v not in ("ssh", "telnet"):
            raise ValueError("协议必须是 ssh 或 telnet")
        return v

    @field_validator("port")
    @classmethod
    def validate_port(cls, v):
        if v < 1 or v > 65535:
            raise ValueError("端口号必须在 1-65535 之间")
        return v

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: Optional[str] = None
    port: Optional[int] = Field(None, ge=1, le=65535)
    device_type: Optional[str] = None
    device_category: Optional[str] = None
    group_ids: Optional[List[int]] = None
    description: Optional[str] = None

class Device(DeviceBase):
    id: int
    connection_status: Optional[str] = Field(default="unknown")
    last_latency: Optional[float] = None
    last_test_time: Optional[datetime] = None
    last_inspection_time: Optional[datetime] = None
    group_names: Optional[List[str]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DevicePublic(BaseModel):
    """对外暴露的设备信息（不含密码）"""
    id: int
    name: str
    ip_address: str
    username: str
    protocol: str
    port: int
    device_type: str
    device_category: str
    group_ids: Optional[List[int]] = None
    group_names: Optional[List[str]] = None
    connection_status: Optional[str] = "unknown"
    last_latency: Optional[float] = None
    last_test_time: Optional[datetime] = None
    last_inspection_time: Optional[datetime] = None
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DeviceImportItem(BaseModel):
    name: str
    ip_address: str
    username: str
    password: str
    protocol: Optional[str] = "ssh"
    port: Optional[int] = 22
    device_type: Optional[str] = "auto"
    device_category: Optional[str] = "switch"
    group_ids: Optional[List[int]] = None
    description: Optional[str] = None

# --- 设备查询参数 ---
class DeviceQueryParams(BaseModel):
    keyword: Optional[str] = None
    group_id: Optional[int] = None
    device_type: Optional[str] = None
    device_category: Optional[str] = None
    ip_address: Optional[str] = None
    skip: int = 0
    limit: int = 100

# --- 巡检命令模型 ---

class InspectionCommandBase(BaseModel):
    name: str = Field(..., description="命令名称", max_length=100)
    command: str = Field(..., description="命令内容", max_length=2000)
    device_type: str = Field(..., description="适用设备类型")
    description: Optional[str] = Field(None, description="命令描述")
    enabled: Optional[bool] = True

class InspectionCommandCreate(InspectionCommandBase):
    pass

class InspectionCommand(InspectionCommandBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- 巡检记录模型 ---

class InspectionRecord(BaseModel):
    id: int
    device_id: Optional[int] = None
    device_name: str
    device_ip: str
    command_name: str
    command_output: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- 单命令巡检执行请求 ---
class InspectionCommandExecuteRequest(BaseModel):
    """单条巡检命令执行请求：支持按设备ID、分组ID、设备类型、设备类别筛选"""
    device_ids: Optional[List[int]] = None
    group_ids: Optional[List[int]] = None
    device_type: Optional[str] = None
    device_category: Optional[str] = None

# --- 巡检执行请求 ---
class InspectionExecuteRequest(BaseModel):
    """巡检执行请求：支持按设备ID、分组ID、设备类型筛选"""
    device_ids: Optional[List[int]] = None
    group_ids: Optional[List[int]] = None
    device_type: Optional[str] = None
    device_category: Optional[str] = None

# --- 通用响应模型 ---

class ResponseModel(BaseModel):
    success: bool = True
    message: str = "操作成功"
    data: Optional[Any] = None

# --- CLI命令请求 ---

class CLICommandRequest(BaseModel):
    command: str = Field(..., description="要执行的命令", max_length=500)

# --- 设备日志查询请求 ---
class DeviceLogQueryRequest(BaseModel):
    device_id: int = Field(..., description="设备ID")
    log_type: str = Field(default="syslog", description="日志类型: syslog/interface/error/all")
    lines: int = Field(default=100, description="返回日志行数", ge=1, le=1000)

# --- 备份相关模型 ---

class BackupBase(BaseModel):
    device_id: Optional[int] = Field(None, description="设备ID")
    backup_type: str = Field(default="running-config", description="备份类型")

class BackupCreate(BackupBase):
    pass

class Backup(BackupBase):
    id: int
    status: str
    file_path: Optional[str] = None
    content: Optional[str] = None
    version: Optional[str] = None
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- AI配置相关模型 ---

class AIConfigBase(BaseModel):
    provider: str = Field(default="openai", description="AI服务提供商")
    api_key: str = Field(..., description="API密钥")
    model: str = Field(default="gpt-4", description="模型名称")
    base_url: str = Field(default="https://api.openai.com/v1", description="API基础URL")
    timeout: int = Field(default=30, description="超时时间", ge=5, le=300)
    enabled: bool = Field(default=False, description="是否启用")

class AIConfig(AIConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AILogAnalysisRequest(BaseModel):
    device_id: int = Field(..., description="设备ID")
    log_content: str = Field(..., description="日志内容")

class AILogAnalysis(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    log_content: str
    analysis_result: Optional[str] = None
    severity: str = "info"
    recommendations: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- 路由跟踪结果 ---

class RouteTraceResult(BaseModel):
    device_id: int
    device_name: str
    device_ip: str
    trace_output: str
    success: bool
