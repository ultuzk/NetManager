from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models import Device, DeviceGroup
from ..schemas import DeviceCreate, DeviceUpdate, DeviceQueryParams
from ..database import encrypt_password, decrypt_password
import paramiko
import socket
import time
import logging
import re
from typing import List, Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# 危险命令黑名单（正则匹配）
_DANGEROUS_RE = [
    re.compile(r"\breboot\b", re.IGNORECASE),
    re.compile(r"\bshutdown\b", re.IGNORECASE),
    re.compile(r"\bformat\b", re.IGNORECASE),
    re.compile(r"\bundo\b", re.IGNORECASE),
    re.compile(r"\bdelete\b", re.IGNORECASE),
    re.compile(r"\berase\b", re.IGNORECASE),
    re.compile(r"\breset\s+saved-configuration\b", re.IGNORECASE),
    re.compile(r"\binitialize\b", re.IGNORECASE),
]

def _is_command_safe(command: str) -> bool:
    """检查命令是否安全"""
    for pattern in _DANGEROUS_RE:
        if pattern.search(command):
            return False
    return True


def _get_device_password(device: Device) -> str:
    """获取设备解密后的密码"""
    try:
        return decrypt_password(device.password)
    except Exception:
        # 兼容旧数据：如果解密失败，当作明文处理
        return device.password


def _sync_device_groups(db: Session, device: Device, group_ids: Optional[List[int]]):
    """同步设备的分组关联"""
    if group_ids is None:
        return
    # 清除现有关联
    device.groups = []
    if group_ids:
        groups = db.query(DeviceGroup).filter(DeviceGroup.id.in_(group_ids)).all()
        device.groups = groups
    db.flush()


class DeviceService:

    @staticmethod
    def create_device(db: Session, device: DeviceCreate) -> Device:
        device_data = device.model_dump()
        group_ids = device_data.pop("group_ids", None)
        device_data["password"] = encrypt_password(device_data["password"])
        db_device = Device(**device_data)
        db.add(db_device)
        db.flush()  # 获取 ID
        _sync_device_groups(db, db_device, group_ids)
        db.commit()
        db.refresh(db_device)
        return db_device

    @staticmethod
    def get_devices(db: Session, skip: int = 0, limit: int = 100,
                    group_id: Optional[int] = None,
                    keyword: Optional[str] = None,
                    device_type: Optional[str] = None,
                    device_category: Optional[str] = None,
                    ip_address: Optional[str] = None,
                    connection_status: Optional[str] = None) -> List[Device]:
        query = db.query(Device)
        if group_id:
            query = query.filter(Device.groups.any(DeviceGroup.id == group_id))
        if keyword:
            query = query.filter(
                or_(
                    Device.name.contains(keyword),
                    Device.ip_address.contains(keyword),
                    Device.description.contains(keyword),
                )
            )
        if device_type:
            query = query.filter(Device.device_type == device_type)
        if device_category:
            query = query.filter(Device.device_category == device_category)
        if ip_address:
            query = query.filter(Device.ip_address.contains(ip_address))
        if connection_status:
            query = query.filter(Device.connection_status == connection_status)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_device(db: Session, device_id: int) -> Optional[Device]:
        return db.query(Device).filter(Device.id == device_id).first()

    @staticmethod
    def update_device(db: Session, device_id: int,
                      device_update: DeviceUpdate) -> Optional[Device]:
        db_device = db.query(Device).filter(Device.id == device_id).first()
        if not db_device:
            return None
        update_data = device_update.model_dump(exclude_unset=True)
        # 处理分组关联
        group_ids = update_data.pop("group_ids", None)
        # 如果更新了密码，加密存储
        if "password" in update_data and update_data["password"]:
            update_data["password"] = encrypt_password(update_data["password"])
        for field, value in update_data.items():
            setattr(db_device, field, value)
        _sync_device_groups(db, db_device, group_ids)
        db.commit()
        db.refresh(db_device)
        return db_device

    @staticmethod
    def delete_device(db: Session, device_id: int) -> bool:
        db_device = db.query(Device).filter(Device.id == device_id).first()
        if not db_device:
            return False
        db_device.groups = []  # 清除关联
        db.delete(db_device)
        db.commit()
        return True

    @staticmethod
    def test_connection(device: Device) -> Dict[str, Any]:
        try:
            if device.protocol == "ssh":
                return DeviceService._test_ssh_connection(device)
            elif device.protocol == "telnet":
                return DeviceService._test_telnet_connection(device)
            else:
                return {"success": False, "message": "不支持的协议"}
        except Exception as e:
            logger.error(f"连接测试失败: {str(e)}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def _test_ssh_connection(device: Device) -> Dict[str, Any]:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.WarningPolicy())
        try:
            password = _get_device_password(device)
            start_time = time.time()
            ssh.connect(
                device.ip_address,
                port=device.port,
                username=device.username,
                password=password,
                timeout=10,
                banner_timeout=30,
                allow_agent=False,
                look_for_keys=False,
            )
            ssh.get_transport().set_keepalive(10)
            latency = round((time.time() - start_time) * 1000, 2)
            ssh.close()
            return {
                "success": True,
                "message": "SSH连接成功",
                "latency": latency,
                "latency_message": f"延迟: {latency}ms",
            }
        except paramiko.AuthenticationException:
            return {"success": False, "message": "认证失败"}
        except paramiko.SSHException as e:
            return {"success": False, "message": f"SSH错误: {str(e)}"}
        except socket.timeout:
            return {"success": False, "message": "连接超时"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def _test_telnet_connection(device: Device) -> Dict[str, Any]:
        try:
            import telnetlib
            password = _get_device_password(device)
            start_time = time.time()
            tn = telnetlib.Telnet(device.ip_address, device.port, timeout=10)
            tn.read_until(b"Username:", timeout=5)
            tn.write(device.username.encode("ascii") + b"\n")
            tn.read_until(b"Password:", timeout=5)
            tn.write(password.encode("ascii") + b"\n")
            latency = round((time.time() - start_time) * 1000, 2)
            tn.close()
            return {
                "success": True,
                "message": "Telnet连接成功",
                "latency": latency,
                "latency_message": f"延迟: {latency}ms",
            }
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def execute_command(device: Device, command: str, timeout: int = 60) -> Dict[str, Any]:
        # 安全检查：拦截危险命令
        if not _is_command_safe(command):
            return {"success": False, "message": "该命令被安全策略禁止执行"}
        if device.protocol == "ssh":
            return DeviceService._execute_ssh_command(device, command, timeout=timeout)
        elif device.protocol == "telnet":
            return DeviceService._execute_telnet_command(device, command)
        else:
            return {"success": False, "message": "不支持的协议"}

    @staticmethod
    def _execute_ssh_command(device: Device, command: str, timeout: int = 60) -> Dict[str, Any]:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.WarningPolicy())
        try:
            password = _get_device_password(device)
            ssh.connect(
                device.ip_address,
                port=device.port,
                username=device.username,
                password=password,
                timeout=30,
                banner_timeout=60,
                allow_agent=False,
                look_for_keys=False,
            )
            ssh.get_transport().set_keepalive(10)
            channel = ssh.invoke_shell()
            time.sleep(1)
            while channel.recv_ready():
                channel.recv(65535)
            for paging_cmd in ("screen-length disable", "screen-length 0 temporary", "terminal length 0"):
                channel.send(paging_cmd + "\n")
                time.sleep(1)
                while channel.recv_ready():
                    channel.recv(65535)
            channel.send(command + "\n")
            output = ""
            start = time.time()
            last_data_time = time.time()
            while time.time() - start < timeout:
                if channel.recv_ready():
                    data = channel.recv(65535).decode("utf-8", errors="ignore")
                    output += data
                    last_data_time = time.time()
                else:
                    time.sleep(0.3)
                if output and (time.time() - last_data_time) > 2:
                    break
            ssh.close()
            return {"success": True, "output": output}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def _execute_telnet_command(device: Device, command: str) -> Dict[str, Any]:
        try:
            import telnetlib
            password = _get_device_password(device)
            tn = telnetlib.Telnet(device.ip_address, device.port, timeout=30)
            tn.read_until(b"Username:", timeout=5)
            tn.write(device.username.encode("ascii") + b"\n")
            tn.read_until(b"Password:", timeout=5)
            tn.write(password.encode("ascii") + b"\n")
            time.sleep(1)
            tn.write(command.encode("ascii") + b"\n")
            time.sleep(2)
            output = tn.read_very_eager().decode("utf-8", errors="ignore")
            tn.close()
            return {"success": True, "output": output}
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def detect_device_type(device: Device) -> str:
        result = DeviceService.execute_command(device, "display version")
        if result.get("success"):
            output = result["output"].lower()
            if "huawei" in output:
                return "huawei"
            elif "h3c" in output or "comware" in output:
                return "h3c"
            elif "ruijie" in output:
                return "ruijie"
            elif "cisco" in output:
                return "cisco"
        result = DeviceService.execute_command(device, "show version")
        if result.get("success"):
            output = result["output"].lower()
            if "cisco" in output:
                return "cisco"
        return "unknown"

    @staticmethod
    def execute_traceroute(device: Device, target_ip: str) -> Dict[str, Any]:
        try:
            if not re.match(r"^(\d{1,3}\.){3}\d{1,3}$", target_ip):
                return {"success": False, "message": "无效的目标IP地址"}
            device_type = (
                device.device_type
                if device.device_type != "auto"
                else DeviceService.detect_device_type(device)
            )
            commands = {
                "huawei": f"tracert {target_ip}",
                "h3c": f"tracert {target_ip}",
                "ruijie": f"traceroute {target_ip}",
                "cisco": f"traceroute {target_ip}",
            }
            command = commands.get(device_type, f"traceroute {target_ip}")
            result = DeviceService.execute_command(device, command)
            if result.get("success"):
                return {
                    "success": True,
                    "trace_output": result["output"],
                    "device_name": device.name,
                    "device_ip": device.ip_address,
                }
            return result
        except Exception as e:
            return {"success": False, "message": str(e)}

    @staticmethod
    def query_device_logs(device: Device, log_type: str = "syslog", lines: int = 100) -> Dict[str, Any]:
        """连接设备查询日志"""
        # 根据设备类型和日志类型选择命令
        device_type = device.device_type if device.device_type != "auto" else DeviceService.detect_device_type(device)
        
        # 日志命令映射
        log_commands = {
            "syslog": {
                "huawei": f"display logbuffer | last {lines}",
                "h3c": f"display logbuffer | last {lines}",
                "ruijie": f"show logging | last {lines}",
                "cisco": f"show logging | last {lines}",
                "default": f"display logbuffer | last {lines}",
            },
            "interface": {
                "huawei": f"display interface brief",
                "h3c": f"display interface brief",
                "ruijie": f"show interface status",
                "cisco": f"show interface status",
                "default": f"display interface brief",
            },
            "error": {
                "huawei": f"display logbuffer | include error | last {lines}",
                "h3c": f"display logbuffer | include error | last {lines}",
                "ruijie": f"show logging | include error | last {lines}",
                "cisco": f"show logging | include error | last {lines}",
                "default": f"display logbuffer | include error | last {lines}",
            },
            "all": {
                "huawei": f"display logbuffer | last {lines}",
                "h3c": f"display logbuffer | last {lines}",
                "ruijie": f"show logging | last {lines}",
                "cisco": f"show logging | last {lines}",
                "default": f"display logbuffer | last {lines}",
            },
        }
        
        cmd_map = log_commands.get(log_type, log_commands["syslog"])
        command = cmd_map.get(device_type, cmd_map["default"])
        
        result = DeviceService.execute_command(device, command, timeout=30)
        if result.get("success"):
            return {
                "success": True,
                "log_content": result["output"],
                "log_type": log_type,
                "device_name": device.name,
                "device_ip": device.ip_address,
                "command": command,
            }
        return result
