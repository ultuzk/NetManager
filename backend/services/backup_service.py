from sqlalchemy.orm import Session
from ..models import Backup, Device
from .device_service import DeviceService
from typing import List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class BackupService:

    @staticmethod
    def get_backups(
        db: Session, device_id: Optional[int] = None
    ) -> List[Backup]:
        query = db.query(Backup)
        if device_id:
            query = query.filter(Backup.device_id == device_id)
        return query.order_by(Backup.created_at.desc()).all()

    @staticmethod
    def get_backup(db: Session, backup_id: int) -> Optional[Backup]:
        return db.query(Backup).filter(Backup.id == backup_id).first()

    @staticmethod
    def delete_backup(db: Session, backup_id: int) -> bool:
        db_backup = db.query(Backup).filter(Backup.id == backup_id).first()
        if not db_backup:
            return False
        db.delete(db_backup)
        db.commit()
        return True

    @staticmethod
    def execute_backup(
        db: Session, device_id: int, backup_type: str = "running-config"
    ) -> dict:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return {"success": False, "message": "设备不存在"}

        try:
            device_type = (
                device.device_type
                if device.device_type != "auto"
                else DeviceService.detect_device_type(device)
            )
            # 如果自动检测失败，不影响备份，使用默认命令
            if device_type == "unknown":
                device_type = "huawei"

            commands = {
                "running-config": {
                    "huawei": "display current-configuration",
                    "h3c": "display current-configuration",
                    "ruijie": "show running-config",
                    "cisco": "show running-config",
                },
                "startup-config": {
                    "huawei": "display saved-configuration",
                    "h3c": "display saved-configuration",
                    "ruijie": "show startup-config",
                    "cisco": "show startup-config",
                },
            }

            type_commands = commands.get(backup_type)
            if not type_commands:
                return {"success": False, "message": "不支持的备份类型"}

            command = type_commands.get(device_type, type_commands.get("cisco"))
            if not command:
                return {"success": False, "message": "不支持的备份类型"}

            # 备份命令可能需要更长时间（大配置），使用 120 秒超时
            result = DeviceService.execute_command(device, command, timeout=120)
            if not result["success"]:
                return {"success": False, "message": result["message"]}

            backup = Backup(
                device_id=device_id,
                backup_type=backup_type,
                status="success",
                content=result["output"],
                version=f"v{datetime.now().strftime('%Y%m%d%H%M%S')}",
                created_at=datetime.now(),
            )
            db.add(backup)
            db.commit()

            return {
                "success": True,
                "message": "备份成功",
                "data": {"backup_id": backup.id},
            }

        except Exception as e:
            logger.error(f"备份失败: {str(e)}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def compare_backups(db: Session, backup_id1: int, backup_id2: int) -> dict:
        backup1 = BackupService.get_backup(db, backup_id1)
        backup2 = BackupService.get_backup(db, backup_id2)

        if not backup1 or not backup2:
            return {"success": False, "message": "备份文件不存在"}

        lines1 = backup1.content.split("\n") if backup1.content else []
        lines2 = backup2.content.split("\n") if backup2.content else []

        diff = []
        max_len = max(len(lines1), len(lines2))

        for i in range(max_len):
            line1 = lines1[i] if i < len(lines1) else None
            line2 = lines2[i] if i < len(lines2) else None

            if line1 != line2:
                diff.append({"line": i + 1, "old": line1, "new": line2})

        return {
            "success": True,
            "data": {
                "backup1": {
                    "id": backup1.id,
                    "version": backup1.version,
                    "created_at": str(backup1.created_at),
                },
                "backup2": {
                    "id": backup2.id,
                    "version": backup2.version,
                    "created_at": str(backup2.created_at),
                },
                "differences": diff,
                "total_differences": len(diff),
            },
        }

    @staticmethod
    def restore_backup(db: Session, device_id: int, backup_id: int) -> dict:
        """
        恢复配置 — 需要用户确认，逐行执行配置命令
        """
        device = db.query(Device).filter(Device.id == device_id).first()
        backup = BackupService.get_backup(db, backup_id)

        if not device or not backup:
            return {"success": False, "message": "设备或备份文件不存在"}

        if not backup.content:
            return {"success": False, "message": "备份内容为空"}

        try:
            # 进入系统视图
            result = DeviceService.execute_command(device, "system-view")
            if not result.get("success", True):
                return {"success": False, "message": "无法进入系统视图"}

            lines = backup.content.split("\n")
            executed = 0
            failed_lines = []

            for line in lines:
                line = line.strip()
                # 跳过空行、注释、系统级声明
                if not line or line.startswith("#") or line.startswith("!"):
                    continue
                if line.startswith("sysname") or line.startswith("hostname"):
                    continue
                if line.startswith("return") or line.startswith("quit"):
                    continue

                result = DeviceService.execute_command(device, line)
                if result["success"]:
                    executed += 1
                else:
                    failed_lines.append({"line": line, "error": result["message"]})

            # 保存配置
            DeviceService.execute_command(device, "save")
            DeviceService.execute_command(device, "return")

            if failed_lines:
                return {
                    "success": True,
                    "message": f"配置恢复部分完成: 成功 {executed} 条, 失败 {len(failed_lines)} 条",
                    "data": {"failed_lines": failed_lines},
                }

            return {"success": True, "message": f"配置恢复成功: 共执行 {executed} 条命令"}

        except Exception as e:
            return {"success": False, "message": str(e)}
