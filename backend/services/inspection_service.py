import asyncio
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from ..models import InspectionCommand, InspectionRecord, Device
from ..schemas import InspectionCommandCreate
from .device_service import DeviceService
from typing import List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# 后台任务执行器
_executor = ThreadPoolExecutor(max_workers=4)


def _run_inspection_task(db_url: str, device_id: int):
    """在后台线程中执行巡检"""
    from backend.database import SessionLocal
    import logging
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        result = _execute_inspection_sync(db, device_id)
        logger.info(f"后台巡检完成: device_id={device_id}, commands={len(result)}")
    except Exception as e:
        logger.error(f"后台巡检失败: device_id={device_id}, error={e}")
    finally:
        db.close()


def _execute_inspection_sync(db: Session, device_id: int) -> List[dict]:
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return []

    device_type = (
        device.device_type
        if device.device_type != 'auto'
        else DeviceService.detect_device_type(device)
    )
    commands = _get_commands_sync(db, device_type)
    results = []

    # 复用 SSH 连接执行所有巡检命令
    import paramiko, time
    from ..database import decrypt_password

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.WarningPolicy())
    try:
        password = decrypt_password(device.password)
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
        # 禁用分页
        for paging_cmd in ("screen-length disable", "screen-length 0 temporary", "terminal length 0"):
            channel.send(paging_cmd + "\n")
            time.sleep(1)
            while channel.recv_ready():
                channel.recv(65535)

        # 逐条执行命令
        for cmd in commands:
            record = InspectionRecord(
                device_id=device.id,
                command_id=cmd.id,
                command_name=cmd.name,
                status="pending",
                created_at=datetime.now(),
            )
            db.add(record)

            try:
                channel.send(cmd.command + "\n")
                output = ""
                start = time.time()
                last_data_time = time.time()
                while time.time() - start < 60:
                    if channel.recv_ready():
                        data = channel.recv(65535).decode("utf-8", errors="ignore")
                        output += data
                        last_data_time = time.time()
                    else:
                        time.sleep(0.3)
                    if output and (time.time() - last_data_time) > 2:
                        break

                record.command_output = output
                record.status = "success"
                results.append({
                    "command_id": cmd.id,
                    "command_name": cmd.name,
                    "status": "success",
                    "output": output,
                })
            except Exception as e:
                record.status = "failed"
                record.error_message = str(e)
                results.append({
                    "command_id": cmd.id,
                    "command_name": cmd.name,
                    "status": "failed",
                    "error": str(e),
                })

        ssh.close()
    except Exception as e:
        # SSH 连接失败，所有命令标记为失败
        for cmd in commands:
            record = InspectionRecord(
                device_id=device.id,
                command_id=cmd.id,
                command_name=cmd.name,
                status="failed",
                error_message=str(e),
                created_at=datetime.now(),
            )
            db.add(record)
            results.append({
                "command_id": cmd.id,
                "command_name": cmd.name,
                "status": "failed",
                "error": str(e),
            })

    db.commit()
    device.last_inspection_time = datetime.now()
    db.commit()

    return results


def _get_commands_sync(db: Session, device_type: Optional[str] = None) -> List[InspectionCommand]:
    query = db.query(InspectionCommand).filter(InspectionCommand.enabled == True)
    if device_type:
        query = query.filter(InspectionCommand.device_type.in_([device_type, 'all']))
    return query.all()


class InspectionService:
    @staticmethod
    def create_command(db: Session, command: InspectionCommandCreate) -> InspectionCommand:
        db_command = InspectionCommand(**command.model_dump())
        db.add(db_command)
        db.commit()
        db.refresh(db_command)
        return db_command

    @staticmethod
    def get_commands(db: Session, device_type: Optional[str] = None) -> List[InspectionCommand]:
        return _get_commands_sync(db, device_type)

    @staticmethod
    def get_command(db: Session, command_id: int) -> Optional[InspectionCommand]:
        return db.query(InspectionCommand).filter(InspectionCommand.id == command_id).first()

    @staticmethod
    def update_command(db: Session, command_id: int, **kwargs) -> Optional[InspectionCommand]:
        db_command = db.query(InspectionCommand).filter(InspectionCommand.id == command_id).first()
        if not db_command:
            return None
        for key, value in kwargs.items():
            setattr(db_command, key, value)
        db.commit()
        db.refresh(db_command)
        return db_command

    @staticmethod
    def delete_command(db: Session, command_id: int) -> bool:
        db_command = db.query(InspectionCommand).filter(InspectionCommand.id == command_id).first()
        if not db_command:
            return False
        db.delete(db_command)
        db.commit()
        return True

    @staticmethod
    def execute_inspection(db: Session, device_id: int) -> List[dict]:
        """同步执行巡检（用于后台任务）"""
        return _execute_inspection_sync(db, device_id)

    @staticmethod
    def execute_batch_inspection(db: Session, device_ids: List[int]) -> dict:
        results = {}
        for device_id in device_ids:
            results[device_id] = _execute_inspection_sync(db, device_id)
        return results

    @staticmethod
    def get_inspection_records(db: Session, device_id: Optional[int] = None,
                              device_type: Optional[str] = None,
                              device_category: Optional[str] = None,
                              start_time: Optional[str] = None,
                              end_time: Optional[str] = None,
                              limit: int = 100) -> List[InspectionRecord]:
        query = db.query(InspectionRecord)
        if device_id:
            query = query.filter(InspectionRecord.device_id == device_id)
        if device_type or device_category:
            query = query.join(Device, InspectionRecord.device_id == Device.id)
            if device_type:
                query = query.filter(Device.device_type == device_type)
            if device_category:
                query = query.filter(Device.device_category == device_category)
        if start_time:
            try:
                from datetime import datetime as dt
                start_dt = dt.fromisoformat(start_time)
                query = query.filter(InspectionRecord.created_at >= start_dt)
            except (ValueError, TypeError):
                pass
        if end_time:
            try:
                from datetime import datetime as dt
                end_dt = dt.fromisoformat(end_time)
                query = query.filter(InspectionRecord.created_at <= end_dt)
            except (ValueError, TypeError):
                pass
        return query.order_by(InspectionRecord.created_at.desc()).limit(limit).all()

    @staticmethod
    def export_records(db: Session, device_id: Optional[int] = None,
                       device_type: Optional[str] = None,
                       device_category: Optional[str] = None,
                       start_time: Optional[str] = None,
                       end_time: Optional[str] = None) -> str:
        records = InspectionService.get_inspection_records(
            db, device_id=device_id, device_type=device_type,
            device_category=device_category, start_time=start_time, end_time=end_time,
        )
        lines = ["设备名称|设备IP|命令名称|状态|执行时间"]
        for record in records:
            device = db.query(Device).filter(Device.id == record.device_id).first()
            device_name = device.name if device else "未知"
            device_ip = device.ip_address if device else "未知"
            lines.append(f"{device_name}|{device_ip}|{record.command_name}|{record.status}|{record.created_at}")
        return "\n".join(lines)

    @staticmethod
    def init_default_commands(db: Session):
        default_commands = [
            {"name": "设备版本", "command": "display version", "device_type": "all", "description": "查看设备版本信息"},
            {"name": "设备名称", "command": "display sysname", "device_type": "all", "description": "查看设备名称"},
            {"name": "接口状态", "command": "display interface brief", "device_type": "all", "description": "查看接口状态"},
            {"name": "CPU使用率", "command": "display cpu-usage", "device_type": "all", "description": "查看CPU使用率"},
            {"name": "内存使用", "command": "display memory-usage", "device_type": "all", "description": "查看内存使用情况"},
            {"name": "VLAN信息", "command": "display vlan brief", "device_type": "all", "description": "查看VLAN信息"},
            {"name": "路由表", "command": "display ip routing-table", "device_type": "all", "description": "查看路由表"},
            {"name": "ARP表", "command": "display arp", "device_type": "all", "description": "查看ARP表"},
            {"name": "MAC地址表", "command": "display mac-address", "device_type": "all", "description": "查看MAC地址表"},
            {"name": "当前配置", "command": "display current-configuration", "device_type": "huawei", "description": "华为设备当前配置"},
            {"name": "当前配置", "command": "display running-config", "device_type": "cisco", "description": "Cisco设备当前配置"},
            {"name": "启动配置", "command": "display saved-configuration", "device_type": "huawei", "description": "华为设备启动配置"},
            {"name": "启动配置", "command": "show startup-config", "device_type": "cisco", "description": "Cisco设备启动配置"},
        ]

        for cmd in default_commands:
            if not db.query(InspectionCommand).filter(InspectionCommand.command == cmd["command"]).first():
                db_command = InspectionCommand(**cmd)
                db.add(db_command)
        db.commit()

def _execute_single_command_sync(device_id: int, command_id: int):
    """在后台线程中执行单条巡检命令（自己管理 db 会话）"""
    from backend.database import SessionLocal
    import logging
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        result = _execute_single_command_for_device(db, device_id, command_id)
        logger.info(f"单命令巡检完成: device_id={device_id}, command_id={command_id}")
        return result
    except Exception as e:
        logger.error(f"单命令巡检失败: device_id={device_id}, command_id={command_id}, error={e}")
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def _execute_single_command_for_device(db: Session, device_id: int, command_id: int) -> dict:
    """对单个设备执行单条巡检命令"""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return {"success": False, "error": "设备不存在"}
    
    command = db.query(InspectionCommand).filter(InspectionCommand.id == command_id).first()
    if not command:
        return {"success": False, "error": "命令不存在"}
    
    # 检查命令是否匹配设备类型
    if command.device_type != "all" and command.device_type != device.device_type:
        return {"success": False, "error": f"命令不适用当前设备类型({device.device_type})"}
    
    record = InspectionRecord(
        device_id=device.id,
        command_id=command.id,
        command_name=command.name,
        status="pending",
        created_at=datetime.now(),
    )
    db.add(record)
    
    try:
        result = DeviceService.execute_command(device, command.command, timeout=60)
        if result.get("success"):
            record.command_output = result.get("output", "")
            record.status = "success"
            db.commit()
            return {"success": True, "output": result.get("output", "")}
        else:
            record.status = "failed"
            record.error_message = result.get("message", "执行失败")
            db.commit()
            return {"success": False, "error": result.get("message", "执行失败")}
    except Exception as e:
        record.status = "failed"
        record.error_message = str(e)
        db.commit()
        return {"success": False, "error": str(e)}


def _get_device_ids_for_command(db: Session, command_id: int,
                                device_ids: Optional[List[int]] = None,
                                group_ids: Optional[List[int]] = None,
                                device_type: Optional[str] = None,
                                device_category: Optional[str] = None) -> List[int]:
    """根据筛选条件获取匹配的设备ID列表"""
    command = db.query(InspectionCommand).filter(InspectionCommand.id == command_id).first()
    if not command:
        return []
    
    result_ids = []
    
    # 1. 直接指定设备ID
    if device_ids:
        for did in device_ids:
            device = db.query(Device).filter(Device.id == did).first()
            if device:
                result_ids.append(did)
    
    # 2. 按分组ID筛选
    elif group_ids:
        for gid in group_ids:
            group = db.query(DeviceGroup).filter(DeviceGroup.id == gid).first()
            if group:
                for device in group.devices:
                    if device.id not in result_ids:
                        result_ids.append(device.id)
    
    # 3. 按设备类型/类别筛选
    elif device_type or device_category:
        query = db.query(Device)
        if device_type:
            query = query.filter(Device.device_type == device_type)
        if device_category:
            query = query.filter(Device.device_category == device_category)
        devices = query.all()
        result_ids = [d.id for d in devices]
    
    # 4. 如果没有筛选条件，返回所有匹配该命令设备类型的设备
    else:
        query = db.query(Device)
        if command.device_type != "all":
            query = query.filter(Device.device_type == command.device_type)
        devices = query.all()
        result_ids = [d.id for d in devices]
    
    return result_ids
