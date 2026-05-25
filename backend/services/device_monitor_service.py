"""
设备在线状态定时监测服务
"""
import threading
import time
import logging
import subprocess
import platform
from datetime import datetime
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import Device
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class DeviceMonitorService:
    """设备在线状态定时监测"""

    _instance = None
    _lock = threading.Lock()
    _running = False
    _thread = None
    _interval = 300  # 默认5分钟检测一次

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def start(self, interval: int = 300):
        """启动监测服务"""
        self._interval = interval
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(f"设备状态监测服务已启动，间隔 {interval} 秒")

    def stop(self):
        """停止监测服务"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("设备状态监测服务已停止")

    def _run_loop(self):
        """监测循环"""
        # 启动后等待一个间隔再开始首次检测
        time.sleep(self._interval)
        while self._running:
            try:
                self._check_all_devices()
            except Exception as e:
                logger.error(f"设备状态检测错误: {e}")
            time.sleep(self._interval)

    def _check_all_devices(self):
        """检测所有设备状态"""
        db = SessionLocal()
        try:
            devices = db.query(Device).all()
            if not devices:
                return

            logger.info(f"开始检测 {len(devices)} 台设备在线状态...")

            # 并发 ping 检测
            with ThreadPoolExecutor(max_workers=10) as executor:
                future_to_device = {
                    executor.submit(self._ping_device, device): device
                    for device in devices
                }
                for future in as_completed(future_to_device):
                    device = future_to_device[future]
                    try:
                        success, latency = future.result()
                        old_status = device.connection_status
                        if success:
                            device.connection_status = "success"
                            device.last_latency = latency
                        else:
                            device.connection_status = "failed"
                            device.last_latency = None
                        device.last_test_time = datetime.now()

                        if old_status != device.connection_status:
                            logger.info(
                                f"设备状态变更: {device.name} ({device.ip_address}) "
                                f"{old_status} -> {device.connection_status}"
                            )
                    except Exception as e:
                        logger.error(f"检测设备 {device.name} 失败: {e}")
                        device.connection_status = "failed"
                        device.last_test_time = datetime.now()

            db.commit()
            online_count = sum(1 for d in devices if d.connection_status == "success")
            logger.info(f"设备状态检测完成: 在线 {online_count}/{len(devices)}")

        except Exception as e:
            logger.error(f"设备状态检测失败: {e}")
        finally:
            db.close()

    def _ping_device(self, device: Device):
        """Ping 单个设备"""
        try:
            system = platform.system().lower()
            if system == "windows":
                cmd = ["ping", "-n", "2", "-w", "3000", device.ip_address]
            else:
                cmd = ["ping", "-c", "2", "-W", "3", device.ip_address]

            start = time.time()
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            elapsed = round((time.time() - start) * 1000, 2)

            success = result.returncode == 0
            # 计算平均延迟
            latency = None
            if success:
                output = result.stdout
                if system == "windows":
                    import re
                    match = re.search(r"平均 = (\d+)ms", output)
                    if match:
                        latency = float(match.group(1))
                    else:
                        match = re.search(r"Average = (\d+)ms", output)
                        if match:
                            latency = float(match.group(1))
                else:
                    import re
                    match = re.search(r"rtt min/avg/max/mdev = [\d.]+/([\d.]+)/", output)
                    if match:
                        latency = float(match.group(1))
                if latency is None:
                    latency = elapsed / 2

            return success, latency

        except subprocess.TimeoutExpired:
            return False, None
        except Exception as e:
            logger.error(f"Ping {device.ip_address} 失败: {e}")
            return False, None


# 全局监测器实例
_monitor = DeviceMonitorService()


def get_monitor() -> DeviceMonitorService:
    return _monitor
