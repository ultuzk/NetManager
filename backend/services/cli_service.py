"""
CLI 交互式会话管理
支持 SSH (paramiko invoke_shell) 和 Telnet (telnetlib) 两种协议
支持流式实时输出推送
"""
import paramiko
import socket
import time
import logging
import re
import threading
from typing import Dict, Optional, Callable
from ..database import decrypt_password
from ..models import Device

logger = logging.getLogger(__name__)

# 分页提示正则（多厂商兼容）
_PAGE_PATTERNS = [
    re.compile(r"----\s*More\s*----", re.IGNORECASE),
    re.compile(r"--More--", re.IGNORECASE),
    re.compile(r"按任意键继续", re.IGNORECASE),
    re.compile(r"Press any key to continue", re.IGNORECASE),
    re.compile(r"\(press Return\)", re.IGNORECASE),
    re.compile(r"---\(more", re.IGNORECASE),
]


class CLISession:
    """单个 CLI 会话，支持流式输出回调"""

    def __init__(self, device: Device, on_output: Optional[Callable[[str], None]] = None):
        self.device = device
        self.ssh_client: Optional[paramiko.SSHClient] = None
        self.ssh_channel: Optional[paramiko.Channel] = None
        self.telnet_conn = None
        self.connected = False
        self.protocol = device.protocol
        self._lock = threading.Lock()
        self._on_output = on_output  # 流式输出回调

    def set_output_callback(self, on_output: Optional[Callable[[str], None]]):
        """设置流式输出回调"""
        self._on_output = on_output

    def _push_output(self, data: str):
        """推送输出到回调"""
        if self._on_output and data:
            try:
                self._on_output(data)
            except Exception as e:
                logger.error(f"输出回调错误: {e}")

    def connect(self) -> bool:
        """建立连接"""
        try:
            if self.protocol == "ssh":
                return self._connect_ssh()
            elif self.protocol == "telnet":
                return self._connect_telnet()
            else:
                logger.error(f"不支持的协议: {self.protocol}")
                return False
        except Exception as e:
            logger.error(f"连接失败: {e}")
            self.connected = False
            return False

    def _connect_ssh(self) -> bool:
        """SSH 交互式连接"""
        password = self._get_password()
        self.ssh_client = paramiko.SSHClient()
        self.ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.ssh_client.connect(
            self.device.ip_address,
            port=self.device.port,
            username=self.device.username,
            password=password,
            timeout=15,
            banner_timeout=30,
            allow_agent=False,
            look_for_keys=False,
        )
        # 创建交互式 shell
        self.ssh_channel = self.ssh_client.invoke_shell(
            term="vt100",
            width=200,
            height=50,
        )
        self.ssh_channel.settimeout(0.1)
        self.connected = True

        # 等待初始 banner/提示符，并推送给前端
        time.sleep(1.5)
        banner = self._read_ssh_output(timeout=3, push=True)
        logger.info(f"SSH 连接成功: {self.device.ip_address}")
        return True

    def _connect_telnet(self) -> bool:
        """Telnet 交互式连接"""
        import telnetlib
        password = self._get_password()
        self.telnet_conn = telnetlib.Telnet(
            self.device.ip_address, self.device.port, timeout=15
        )
        # 等待用户名提示
        self.telnet_conn.read_until(b"Username:", timeout=5)
        self.telnet_conn.write(self.device.username.encode("ascii") + b"\n")
        # 等待密码提示
        self.telnet_conn.read_until(b"Password:", timeout=5)
        self.telnet_conn.write(password.encode("ascii") + b"\n")
        time.sleep(1)
        # 读取登录后的输出并推送
        output = self.telnet_conn.read_very_eager().decode("utf-8", errors="ignore")
        if output:
            self._push_output(output)
        logger.info(f"Telnet 连接成功: {self.device.ip_address}")
        self.connected = True
        return True

    def send_command(self, command: str) -> str:
        """发送命令并读取回显（兼容旧接口）"""
        with self._lock:
            if not self.connected:
                return "错误：未连接"
            try:
                if self.protocol == "ssh":
                    return self._send_ssh_command(command)
                elif self.protocol == "telnet":
                    return self._send_telnet_command(command)
                else:
                    return f"错误：不支持的协议 {self.protocol}"
            except Exception as e:
                logger.error(f"命令执行错误: {e}")
                return f"错误: {str(e)}"

    def send_command_streaming(self, command: str):
        """
        发送命令并以流式方式推送输出。
        返回值: (success: bool, error_msg: str)
        """
        with self._lock:
            if not self.connected:
                self._push_output("\r\n错误：未连接\r\n")
                return False, "未连接"
            try:
                if self.protocol == "ssh":
                    self._send_ssh_command_streaming(command)
                elif self.protocol == "telnet":
                    self._send_telnet_command_streaming(command)
                return True, ""
            except Exception as e:
                logger.error(f"命令执行错误: {e}")
                self._push_output(f"\r\n错误: {str(e)}\r\n")
                return False, str(e)

    def _send_ssh_command(self, command: str) -> str:
        """SSH 发送命令并读取回显（非流式，兼容旧接口）"""
        self.ssh_channel.send(command + "\n")
        time.sleep(0.3)
        return self._read_ssh_output(timeout=8, push=False)

    def _send_ssh_command_streaming(self, command: str):
        """SSH 发送命令并流式推送输出"""
        self.ssh_channel.send(command + "\n")
        time.sleep(0.2)
        self._read_ssh_output(timeout=15, push=True)

    def _send_telnet_command(self, command: str) -> str:
        """Telnet 发送命令并读取回显（非流式）"""
        self.telnet_conn.write(command.encode("ascii") + b"\n")
        time.sleep(0.5)
        return self._read_telnet_output(timeout=8, push=False)

    def _send_telnet_command_streaming(self, command: str):
        """Telnet 发送命令并流式推送输出"""
        self.telnet_conn.write(command.encode("ascii") + b"\n")
        time.sleep(0.3)
        self._read_telnet_output(timeout=15, push=True)

    def _is_paging_prompt(self, data: str) -> bool:
        """检查是否是分页提示"""
        for pattern in _PAGE_PATTERNS:
            if pattern.search(data):
                return True
        return False

    def _read_ssh_output(self, timeout: float = 5.0, push: bool = False) -> str:
        """读取 SSH channel 输出"""
        output = ""
        end_time = time.time() + timeout
        last_data_time = time.time()
        paging_count = 0
        max_pages = 50  # 最多处理 50 页分页

        while time.time() - end_time:
            try:
                if self.ssh_channel.recv_ready():
                    data = self.ssh_channel.recv(4096).decode("utf-8", errors="ignore")
                    if data:
                        output += data
                        if push:
                            self._push_output(data)
                        last_data_time = time.time()

                        # 处理分页提示
                        if paging_count < max_pages and self._is_paging_prompt(data):
                            paging_count += 1
                            time.sleep(0.1)
                            self.ssh_channel.send(b" ")
                            time.sleep(0.2)
                    else:
                        time.sleep(0.05)
                else:
                    # 超过 1.5 秒没有新数据，认为输出结束
                    if time.time() - last_data_time > 1.5:
                        break
                    time.sleep(0.05)
            except socket.timeout:
                break
            except Exception as e:
                logger.error(f"读取 SSH 输出错误: {e}")
                break

        return output

    def _read_telnet_output(self, timeout: float = 5.0, push: bool = False) -> str:
        """读取 Telnet 输出"""
        output = ""
        end_time = time.time() + timeout
        last_data_time = time.time()
        paging_count = 0
        max_pages = 50

        while time.time() < end_time:
            try:
                data = self.telnet_conn.read_very_eager().decode("utf-8", errors="ignore")
                if data:
                    output += data
                    if push:
                        self._push_output(data)
                    last_data_time = time.time()

                    # 处理分页提示
                    if paging_count < max_pages and self._is_paging_prompt(data):
                        paging_count += 1
                        time.sleep(0.1)
                        self.telnet_conn.write(b" ")
                        time.sleep(0.2)
                else:
                    if time.time() - last_data_time > 1.5:
                        break
                    time.sleep(0.1)
            except Exception:
                break

        return output

    def resize_terminal(self, cols: int, rows: int):
        """调整终端大小"""
        if self.ssh_channel and self.connected:
            try:
                self.ssh_channel.resize_pty(width=cols, height=rows)
            except Exception as e:
                logger.error(f"调整终端大小失败: {e}")

    def close(self):
        """关闭连接"""
        self.connected = False
        self._on_output = None
        try:
            if self.ssh_channel:
                self.ssh_channel.close()
        except Exception:
            pass
        try:
            if self.ssh_client:
                self.ssh_client.close()
        except Exception:
            pass
        try:
            if self.telnet_conn:
                self.telnet_conn.close()
        except Exception:
            pass
        logger.info(f"CLI 会话已关闭: {self.device.ip_address}")

    def _get_password(self) -> str:
        try:
            return decrypt_password(self.device.password)
        except Exception:
            return self.device.password


# 全局会话管理
_active_sessions: Dict[str, CLISession] = {}
_session_lock = threading.Lock()


def get_or_create_session(device: Device, on_output: Optional[Callable[[str], None]] = None) -> CLISession:
    """获取或创建 CLI 会话"""
    session_key = f"{device.id}_{device.ip_address}"
    with _session_lock:
        session = _active_sessions.get(session_key)
        if session and session.connected:
            # 更新回调
            if on_output:
                session.set_output_callback(on_output)
            return session
        # 创建新会话
        session = CLISession(device, on_output=on_output)
        if session.connect():
            _active_sessions[session_key] = session
            return session
        raise ConnectionError(f"无法连接到设备 {device.ip_address}:{device.port}")


def close_session(device_id: int, ip_address: str):
    """关闭 CLI 会话"""
    session_key = f"{device_id}_{ip_address}"
    with _session_lock:
        session = _active_sessions.pop(session_key, None)
        if session:
            session.close()
