from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, get_db
from .models import Base
from .routers import devices, groups, inspection, backups, ai, tools, auth, logs, scheduled_backups
from .services.inspection_service import InspectionService
from .services.auth_service import AuthService
from .services.scheduled_backup_service import get_scheduler as get_backup_scheduler
from .services.device_monitor_service import get_monitor as get_device_monitor
import uvicorn
import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# 确保数据目录存在
os.makedirs("./data", exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="网络设备统一管理平台", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(logs.router)
app.include_router(scheduled_backups.router)
app.include_router(devices.router)
app.include_router(groups.router)
app.include_router(inspection.router)
app.include_router(backups.router)
app.include_router(ai.router)
app.include_router(tools.router)


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        # 初始化默认巡检命令
        InspectionService.init_default_commands(db)
        # 初始化默认 admin 账号
        AuthService.init_default_admin(db)
    finally:
        db.close()

    # 启动定时备份调度器
    get_backup_scheduler().start()

    # 启动设备状态监测（每5分钟）
    get_device_monitor().start(interval=300)


@app.on_event("shutdown")
def shutdown_event():
    get_backup_scheduler().stop()
    get_device_monitor().stop()


@app.get("/")
def read_root():
    return {"message": "网络设备统一管理平台 API"}


# ========== CLI WebSocket 路由 ==========
import json
import asyncio
import threading
from .database import get_db as _get_db
from .models import Device as DeviceModel
from .services.cli_service import get_or_create_session, close_session
from .services.log_service import LogService


@app.websocket("/ws/cli/{device_id}")
async def cli_websocket_endpoint(websocket: WebSocket, device_id: int):
    """CLI 交互式 WebSocket 端点 — 流式实时输出"""
    await websocket.accept()

    db = next(_get_db())
    session = None
    try:
        device = db.query(DeviceModel).filter(DeviceModel.id == device_id).first()
        if not device:
            await websocket.send_json({"type": "error", "message": "设备不存在"})
            await websocket.close()
            return

        # 创建线程安全的输出队列
        output_queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def on_output(data: str):
            """CLI 会话的输出回调"""
            try:
                loop.call_soon_threadsafe(output_queue.put_nowait, data)
            except Exception:
                pass

        # 在线程池中建立 CLI 会话
        try:
            session = await loop.run_in_executor(
                None, get_or_create_session, device, on_output
            )
            await websocket.send_json({
                "type": "connected",
                "message": f"已连接到 {device.name} ({device.ip_address}:{device.port})",
                "protocol": device.protocol,
            })
            # 记录连接日志
            LogService.add_connection_log(
                db, username="system", device_id=device.id,
                device_name=device.name, device_ip=device.ip_address,
                protocol=device.protocol, action="connect",
                result="success",
            )
        except ConnectionError as e:
            await websocket.send_json({"type": "error", "message": str(e)})
            LogService.add_connection_log(
                db, username="system", device_id=device.id,
                device_name=device.name, device_ip=device.ip_address,
                protocol=device.protocol, action="connect",
                result="failed", error_message=str(e),
            )
            await websocket.close()
            return

        # 启动输出转发任务
        async def forward_output():
            try:
                while True:
                    data = await asyncio.wait_for(output_queue.get(), timeout=30)
                    await websocket.send_json({"type": "output", "data": data})
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass

        forwarder = asyncio.create_task(forward_output())

        # 命令交互循环
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)

                # 处理终端大小调整
                if msg.get("type") == "resize":
                    cols = msg.get("cols", 200)
                    rows = msg.get("rows", 50)
                    await loop.run_in_executor(None, session.resize_terminal, cols, rows)
                    continue

                command = msg.get("command", "")

                # 空命令跳过
                if not command.strip():
                    continue

                # exit/quit 断开连接
                if command.strip().lower() in ("exit", "quit"):
                    await websocket.send_json({"type": "info", "message": "会话已断开"})
                    LogService.add_connection_log(
                        db, username="system", device_id=device.id,
                        device_name=device.name, device_ip=device.ip_address,
                        protocol=device.protocol, action="disconnect",
                        result="success",
                    )
                    break

                # 记录命令日志
                LogService.add_connection_log(
                    db, username="system", device_id=device.id,
                    device_name=device.name, device_ip=device.ip_address,
                    protocol=device.protocol, action="command",
                    command=command,
                )

                # 在线程池中执行命令（流式输出通过 on_output 回调推送）
                await loop.run_in_executor(
                    None, session.send_command_streaming, command
                )

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "无效的消息格式"})
            except Exception as e:
                logging.error(f"CLI 命令错误: {e}")
                try:
                    await websocket.send_json({"type": "error", "message": f"命令执行失败: {str(e)}"})
                except Exception:
                    pass
                break

        forwarder.cancel()

    finally:
        try:
            if session:
                await loop.run_in_executor(
                    None, close_session, device_id, device.ip_address if device else ""
                )
        except Exception:
            pass
        db.close()


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
    )
