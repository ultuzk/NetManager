"""
定时备份服务
"""
import threading
import time
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import ScheduledBackup, Device, DeviceGroup, Backup
from .device_service import DeviceService
from typing import List, Optional

logger = logging.getLogger(__name__)


class ScheduledBackupService:
    """定时备份调度器"""

    _instance = None
    _lock = threading.Lock()
    _running = False
    _thread = None

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def start(self):
        """启动定时备份调度器"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("定时备份调度器已启动")

    def stop(self):
        """停止定时备份调度器"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("定时备份调度器已停止")

    def _run_loop(self):
        """调度循环"""
        while self._running:
            try:
                self._check_and_execute()
            except Exception as e:
                logger.error(f"定时备份调度错误: {e}")
            # 每分钟检查一次
            time.sleep(60)

    def _check_and_execute(self):
        """检查是否有需要执行的定时备份"""
        db = SessionLocal()
        try:
            now = datetime.now()
            schedules = db.query(ScheduledBackup).filter(
                ScheduledBackup.enabled == True,
            ).all()

            for schedule in schedules:
                # 计算下次执行时间
                if schedule.next_run_time is None:
                    if schedule.last_run_time:
                        next_run = schedule.last_run_time + timedelta(days=schedule.interval_days)
                    else:
                        next_run = now.replace(hour=schedule.hour, minute=schedule.minute, second=0, microsecond=0)
                        if next_run < now:
                            next_run += timedelta(days=schedule.interval_days)
                    schedule.next_run_time = next_run
                    db.commit()

                # 检查是否到执行时间
                if schedule.next_run_time and schedule.next_run_time <= now:
                    logger.info(f"执行定时备份: {schedule.name}")
                    self._execute_scheduled_backup(db, schedule)

        except Exception as e:
            logger.error(f"检查定时备份失败: {e}")
        finally:
            db.close()

    def _execute_scheduled_backup(self, db: Session, schedule: ScheduledBackup) -> dict:
        """执行定时备份，返回详细执行结果"""
        run_detail = {
            "success_count": 0,
            "fail_count": 0,
            "total": 0,
            "devices": [],
        }
        try:
            # 获取目标设备
            device_ids = self._get_target_device_ids(db, schedule)
            if not device_ids:
                schedule.last_run_time = datetime.now()
                schedule.last_result = "warning"
                schedule.last_message = "未找到匹配的设备"
                schedule.next_run_time = datetime.now() + timedelta(days=schedule.interval_days)
                db.commit()
                run_detail["message"] = "未找到匹配的设备"
                return run_detail

            success_count = 0
            fail_count = 0
            errors = []

            for device_id in device_ids:
                device_result = {"device_id": device_id, "device_name": "", "status": "pending", "message": ""}
                try:
                    device = db.query(Device).filter(Device.id == device_id).first()
                    if not device:
                        device_result["status"] = "failed"
                        device_result["message"] = "设备不存在"
                        run_detail["devices"].append(device_result)
                        fail_count += 1
                        continue
                    device_result["device_name"] = device.name
                    result = DeviceService.execute_command(device, self._get_backup_command(device, schedule.backup_type))
                    if result.get("success"):
                        backup = Backup(
                            device_id=device.id,
                            backup_type=schedule.backup_type,
                            status="success",
                            content=result.get("output", ""),
                            created_at=datetime.now(),
                        )
                        db.add(backup)
                        success_count += 1
                        device_result["status"] = "success"
                        device_result["message"] = "备份成功"
                    else:
                        fail_count += 1
                        device_result["status"] = "failed"
                        device_result["message"] = result.get("message", "失败")
                        errors.append(f"{device.name}: {result.get('message', '失败')}")
                except Exception as e:
                    fail_count += 1
                    device_result["status"] = "failed"
                    device_result["message"] = str(e)
                    errors.append(f"设备 {device_id}: {str(e)}")
                run_detail["devices"].append(device_result)

            db.commit()

            schedule.last_run_time = datetime.now()
            schedule.last_result = "success" if fail_count == 0 else ("partial" if success_count > 0 else "failed")
            schedule.last_message = f"成功 {success_count} 台, 失败 {fail_count} 台"
            if errors:
                schedule.last_message += f"; 错误: {'; '.join(errors[:5])}"
            schedule.next_run_time = datetime.now() + timedelta(days=schedule.interval_days)
            db.commit()

            run_detail["success_count"] = success_count
            run_detail["fail_count"] = fail_count
            run_detail["total"] = len(device_ids)
            run_detail["message"] = schedule.last_message
            logger.info(f"定时备份完成: {schedule.name} - {schedule.last_message}")

        except Exception as e:
            logger.error(f"执行定时备份失败: {e}")
            schedule.last_run_time = datetime.now()
            schedule.last_result = "failed"
            schedule.last_message = str(e)
            schedule.next_run_time = datetime.now() + timedelta(days=schedule.interval_days)
            db.commit()
            run_detail["message"] = str(e)
            run_detail["fail_count"] = run_detail["total"]

        return run_detail

    def _get_target_device_ids(self, db: Session, schedule: ScheduledBackup) -> List[int]:
        """获取定时备份的目标设备ID列表"""
        device_ids = []

        # 指定了设备ID
        if schedule.device_ids:
            ids = [int(x.strip()) for x in schedule.device_ids.split(",") if x.strip().isdigit()]
            for did in ids:
                device = db.query(Device).filter(Device.id == did).first()
                if device:
                    device_ids.append(did)
            return device_ids

        # 指定了分组
        if schedule.group_ids:
            gids = [int(x.strip()) for x in schedule.group_ids.split(",") if x.strip().isdigit()]
            for gid in gids:
                group = db.query(DeviceGroup).filter(DeviceGroup.id == gid).first()
                if group:
                    for device in group.devices:
                        if device.id not in device_ids:
                            device_ids.append(device.id)
            return device_ids

        # 按类型/类别筛选
        query = db.query(Device)
        if schedule.device_type:
            query = query.filter(Device.device_type == schedule.device_type)
        if schedule.device_category:
            query = query.filter(Device.device_category == schedule.device_category)
        devices = query.all()
        return [d.id for d in devices]

    def _get_backup_command(self, device: Device, backup_type: str) -> str:
        """获取备份命令"""
        device_type = device.device_type if device.device_type != "auto" else "huawei"
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
        cmd_map = commands.get(backup_type, commands["running-config"])
        return cmd_map.get(device_type, cmd_map.get("huawei", "display current-configuration"))


# 全局调度器实例
_scheduler = ScheduledBackupService()


def get_scheduler() -> ScheduledBackupService:
    return _scheduler
