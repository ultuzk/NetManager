from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from ..database import get_db
from ..schemas import ResponseModel
from ..models import Device as DeviceModel
from ..services.device_service import DeviceService
import subprocess
import platform
import re
import socket
import time
import logging
import concurrent.futures

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["运维工具"])


# ========== 请求模型 ==========

class PingRequest(BaseModel):
    target: str
    count: int = 4
    timeout: int = 5


class BatchPingRequest(BaseModel):
    targets: List[str]
    count: int = 4
    timeout: int = 5


class TraceRequest(BaseModel):
    target: str
    max_hops: int = 30
    timeout: int = 3


class TcpPingRequest(BaseModel):
    target: str
    port: int = 80
    count: int = 4
    timeout: int = 5


class UdpPingRequest(BaseModel):
    target: str
    port: int = 53
    count: int = 4
    timeout: int = 5


class DnsRequest(BaseModel):
    domain: str
    dns_server: Optional[str] = None


class BatchDnsRequest(BaseModel):
    domains: List[str]
    dns_server: Optional[str] = None


class WhoisRequest(BaseModel):
    domain: str


# ========== 工具函数 ==========

def _validate_target(target: str) -> bool:
    if re.match(r"^(\d{1,3}\.){3}\d{1,3}$", target):
        for part in target.split("."):
            if int(part) > 255:
                return False
        return True
    if re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$", target):
        return True
    return False


def _parse_ping_output(output: str) -> dict:
    """解析 ping 输出，提取统计信息"""
    stats = {}
    system = platform.system().lower()
    if system == "windows":
        rtt_match = re.search(r"最短 = (\d+)ms，最长 = (\d+)ms，平均 = (\d+)ms", output)
        if rtt_match:
            stats["min_ms"] = int(rtt_match.group(1))
            stats["max_ms"] = int(rtt_match.group(2))
            stats["avg_ms"] = int(rtt_match.group(3))
        loss_match = re.search(r"丢失 = \((\d+)% 丢失\)", output)
        if loss_match:
            stats["loss_percent"] = int(loss_match.group(1))
        # 中文 Windows 也可能显示英文
        rtt_en = re.search(r"Minimum = (\d+)ms, Maximum = (\d+)ms, Average = (\d+)ms", output)
        if rtt_en and not rtt_match:
            stats["min_ms"] = int(rtt_en.group(1))
            stats["max_ms"] = int(rtt_en.group(2))
            stats["avg_ms"] = int(rtt_en.group(3))
        loss_en = re.search(r"(\d+)% loss", output)
        if loss_en and not loss_match:
            stats["loss_percent"] = int(loss_en.group(1))
    else:
        rtt_match = re.search(r"rtt min/avg/max/mdev = ([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+)", output)
        if rtt_match:
            stats["min_ms"] = float(rtt_match.group(1))
            stats["avg_ms"] = float(rtt_match.group(2))
            stats["max_ms"] = float(rtt_match.group(3))
        loss_match = re.search(r"(\d+)% packet loss", output)
        if loss_match:
            stats["loss_percent"] = int(loss_match.group(1))
    return stats


# ========== Ping ==========

@router.post("/ping/", response_model=ResponseModel)
def tool_ping(req: PingRequest):
    if not _validate_target(req.target):
        return ResponseModel(success=False, message="无效的目标地址")

    system = platform.system().lower()
    try:
        if system == "windows":
            cmd = ["ping", "-n", str(req.count), "-w", str(req.timeout * 1000), req.target]
        else:
            cmd = ["ping", "-c", str(req.count), "-W", str(req.timeout), req.target]

        result = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=req.timeout * req.count + 10,
        )
        output = result.stdout or result.stderr or ""
        stats = _parse_ping_output(output)

        return ResponseModel(
            success=result.returncode == 0,
            data={"output": output, "stats": stats, "target": req.target},
        )
    except subprocess.TimeoutExpired:
        return ResponseModel(success=False, message="Ping 超时")
    except Exception as e:
        return ResponseModel(success=False, message=f"Ping 失败: {str(e)}")


@router.post("/ping/batch/", response_model=ResponseModel)
def tool_batch_ping(req: BatchPingRequest):
    if not req.targets:
        return ResponseModel(success=False, message="目标列表不能为空")

    invalid = [t for t in req.targets if not _validate_target(t.strip())]
    if invalid:
        return ResponseModel(success=False, message=f"无效的目标地址: {', '.join(invalid)}")

    results = []
    for target in req.targets:
        target = target.strip()
        if not target:
            continue
        try:
            single_req = PingRequest(target=target, count=req.count, timeout=req.timeout)
            res = tool_ping(single_req)
            results.append({
                "target": target,
                "success": res.success,
                "data": res.data,
                "message": res.message,
            })
        except Exception as e:
            results.append({"target": target, "success": False, "message": str(e)})

    success_count = sum(1 for r in results if r.get("success"))
    return ResponseModel(
        success=True,
        data={
            "results": results,
            "total": len(results),
            "success_count": success_count,
            "failed_count": len(results) - success_count,
        },
    )


# ========== Traceroute ==========

@router.post("/traceroute/", response_model=ResponseModel)
def tool_traceroute(req: TraceRequest, db: Session = Depends(get_db)):
    if not _validate_target(req.target):
        return ResponseModel(success=False, message="无效的目标地址")

    system = platform.system().lower()
    try:
        if system == "windows":
            cmd = ["tracert", "-d", "-h", str(req.max_hops), "-w", str(req.timeout * 1000), req.target]
        else:
            cmd = ["traceroute", "-n", "-m", str(req.max_hops), "-w", str(req.timeout), req.target]

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120,
        )
        output = result.stdout or result.stderr or ""

        # 解析跳数 — 兼容多种格式
        hops = []
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Linux/Mac: " 1  192.168.1.1  1.234 ms"
            hop_match = re.match(r"^\s*(\d+)\s+(.+)$", line)
            if hop_match:
                hop_num = int(hop_match.group(1))
                hop_info = hop_match.group(2).strip()
                # 过滤掉空跳（* * *）
                if hop_info and hop_info != "* * *":
                    hops.append({"hop": hop_num, "info": hop_info})
            # Windows: "  1    <1 ms    <1 ms    <1 ms  192.168.1.1"
            win_match = re.match(r"^\s*(\d+)\s+(.+)$", line)
            if win_match and not hop_match:
                hop_num = int(win_match.group(1))
                hop_info = win_match.group(2).strip()
                if hop_info:
                    hops.append({"hop": hop_num, "info": hop_info})

        return ResponseModel(
            success=True,
            data={"output": output, "hops": hops, "target": req.target},
        )
    except subprocess.TimeoutExpired:
        return ResponseModel(success=False, message="路由追踪超时")
    except Exception as e:
        return ResponseModel(success=False, message=f"路由追踪失败: {str(e)}")


@router.post("/device-traceroute/", response_model=ResponseModel)
def tool_device_traceroute(
    device_id: int = Query(...),
    target: str = Query(...),
    db: Session = Depends(get_db),
):
    device = db.query(DeviceModel).filter(DeviceModel.id == device_id).first()
    if not device:
        return ResponseModel(success=False, message="设备不存在")
    if not _validate_target(target):
        return ResponseModel(success=False, message="无效的目标地址")

    result = DeviceService.execute_traceroute(device, target)
    return ResponseModel(
        success=result["success"],
        message=result.get("message", "路由追踪完成"),
        data=result,
    )


# ========== TCPing ==========

@router.post("/tcping/", response_model=ResponseModel)
def tool_tcping(req: TcpPingRequest):
    if not _validate_target(req.target):
        return ResponseModel(success=False, message="无效的目标地址")
    if req.port < 1 or req.port > 65535:
        return ResponseModel(success=False, message="端口号必须在 1-65535 之间")

    results = []
    successes = 0
    latencies = []

    for i in range(req.count):
        try:
            start = time.time()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(req.timeout)
            result = sock.connect_ex((req.target, req.port))
            elapsed = round((time.time() - start) * 1000, 2)
            sock.close()

            if result == 0:
                successes += 1
                latencies.append(elapsed)
                results.append(f"TCP {req.target}:{req.port} - 连接成功 - {elapsed}ms")
            else:
                results.append(f"TCP {req.target}:{req.port} - 连接失败 - {elapsed}ms")
        except socket.timeout:
            results.append(f"TCP {req.target}:{req.port} - 超时")
        except Exception as e:
            results.append(f"TCP {req.target}:{req.port} - 错误: {str(e)}")

        if i < req.count - 1:
            time.sleep(0.5)

    success_rate = round((successes / req.count) * 100) if req.count > 0 else 0
    stats = {
        "target": req.target, "port": req.port,
        "total": req.count, "success": successes, "failed": req.count - successes,
        "success_rate": success_rate,
    }
    if latencies:
        stats["min_ms"] = min(latencies)
        stats["max_ms"] = max(latencies)
        stats["avg_ms"] = round(sum(latencies) / len(latencies), 2)

    return ResponseModel(success=successes > 0, data={"output": "\n".join(results), "stats": stats})


# ========== UDPing ==========

@router.post("/udpping/", response_model=ResponseModel)
def tool_udpping(req: UdpPingRequest):
    if not _validate_target(req.target):
        return ResponseModel(success=False, message="无效的目标地址")
    if req.port < 1 or req.port > 65535:
        return ResponseModel(success=False, message="端口号必须在 1-65535 之间")

    results = []
    successes = 0
    latencies = []

    for i in range(req.count):
        try:
            start = time.time()
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(min(req.timeout, 5))  # UDP 超时最多 5 秒，避免长时间阻塞
            sock.sendto(b"\x00", (req.target, req.port))
            try:
                data, addr = sock.recvfrom(1024)
                elapsed = round((time.time() - start) * 1000, 2)
                successes += 1
                latencies.append(elapsed)
                results.append(f"UDP {req.target}:{req.port} - 收到响应 - {elapsed}ms")
            except socket.timeout:
                elapsed = round((time.time() - start) * 1000, 2)
                results.append(f"UDP {req.target}:{req.port} - 无响应(可能开放) - {elapsed}ms")
                successes += 1
            finally:
                sock.close()
        except Exception as e:
            results.append(f"UDP {req.target}:{req.port} - 错误: {str(e)}")

        if i < req.count - 1:
            time.sleep(0.3)

    stats = {
        "target": req.target, "port": req.port,
        "total": req.count, "success": successes,
        "note": "UDP 无响应可能表示端口开放但不回复",
    }
    if latencies:
        stats["min_ms"] = min(latencies)
        stats["max_ms"] = max(latencies)
        stats["avg_ms"] = round(sum(latencies) / len(latencies), 2)

    return ResponseModel(success=True, data={"output": "\n".join(results), "stats": stats})


# ========== DNS ==========

@router.post("/dns/", response_model=ResponseModel)
def tool_dns(req: DnsRequest):
    if not req.domain:
        return ResponseModel(success=False, message="请输入域名")

    try:
        results = []
        # A 记录
        try:
            ips = socket.getaddrinfo(req.domain, None, socket.AF_INET)
            a_records = list(set([ip[4][0] for ip in ips]))
            results.append(f"A 记录: {', '.join(a_records)}")
        except Exception:
            results.append("A 记录: 查询失败")

        # dig / nslookup
        system = platform.system().lower()
        if system != "windows":
            try:
                cmd = ["dig", "+short", req.domain]
                if req.dns_server:
                    cmd = ["dig", "+short", f"@{req.dns_server}", req.domain]
                dig_result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if dig_result.stdout.strip():
                    results.append(f"Dig 结果:\n{dig_result.stdout.strip()}")
            except Exception:
                pass
        else:
            try:
                cmd = ["nslookup", req.domain]
                if req.dns_server:
                    cmd = ["nslookup", req.domain, req.dns_server]
                ns_result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if ns_result.stdout.strip():
                    results.append(f"Nslookup 结果:\n{ns_result.stdout.strip()}")
            except Exception:
                pass

        # 反向解析
        try:
            ip = socket.gethostbyname(req.domain)
            try:
                hostname = socket.gethostbyaddr(ip)
                results.append(f"反向解析: {hostname[0]}")
            except Exception:
                pass
        except Exception:
            pass

        return ResponseModel(success=True, data={"output": "\n\n".join(results), "domain": req.domain})
    except Exception as e:
        return ResponseModel(success=False, message=f"DNS 查询失败: {str(e)}")


@router.post("/dns/batch/", response_model=ResponseModel)
def tool_batch_dns(req: BatchDnsRequest):
    if not req.domains:
        return ResponseModel(success=False, message="域名列表不能为空")

    results = []
    for domain in req.domains:
        domain = domain.strip()
        if not domain:
            continue
        try:
            single_req = DnsRequest(domain=domain, dns_server=req.dns_server)
            res = tool_dns(single_req)
            results.append({
                "domain": domain,
                "success": res.success,
                "data": res.data,
                "message": res.message,
            })
        except Exception as e:
            results.append({"domain": domain, "success": False, "message": str(e)})

    success_count = sum(1 for r in results if r.get("success"))
    return ResponseModel(
        success=True,
        data={
            "results": results,
            "total": len(results),
            "success_count": success_count,
            "failed_count": len(results) - success_count,
        },
    )


# ========== Whois ==========

@router.post("/whois/", response_model=ResponseModel)
def tool_whois(req: WhoisRequest):
    if not req.domain:
        return ResponseModel(success=False, message="请输入域名")

    system = platform.system().lower()
    output = None

    # 1. 尝试系统 whois 命令
    try:
        if system == "windows":
            try:
                cmd = ["whois", req.domain]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                output = result.stdout or ""
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass
            if not output:
                try:
                    cmd = ["powershell", "-Command", f"whois {req.domain}"]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                    output = result.stdout or result.stderr or ""
                except Exception:
                    pass
        else:
            cmd = ["whois", req.domain]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            output = result.stdout or result.stderr or ""
    except Exception:
        pass

    # 2. 如果系统 whois 有有效结果，直接返回
    if output and len(output.strip()) > 20 and "No match" not in output and "NOT FOUND" not in output.upper():
        return ResponseModel(success=True, data={"output": output, "domain": req.domain, "source": "system"})

    # 3. 回退到在线 whois API
    try:
        import urllib.request
        url = f"https://api.whois.vu/?q={req.domain}"
        req_obj = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req_obj, timeout=10) as resp:
            data = resp.read().decode("utf-8")
            if data and len(data.strip()) > 10:
                return ResponseModel(success=True, data={"output": data, "domain": req.domain, "source": "online"})
    except Exception:
        pass

    # 4. 如果系统 whois 有输出但匹配不到，返回系统输出 + 提示
    if output and output.strip():
        return ResponseModel(success=True, data={"output": output, "domain": req.domain, "source": "system", "note": "未找到完整注册信息"})

    return ResponseModel(
        success=False,
        message="Whois 查询失败。服务器未安装 whois 工具，且在线查询也未能获取结果。"
    )


# ========== 端口扫描 ==========

@router.post("/port-scan/", response_model=ResponseModel)
def tool_port_scan(
    target: str = Query(...),
    ports: str = Query(default="22,23,80,443,3389,8080"),
    timeout: int = Query(default=3, ge=1, le=10),
):
    if not _validate_target(target):
        return ResponseModel(success=False, message="无效的目标地址")

    port_list = []
    for p in ports.split(","):
        p = p.strip()
        if "-" in p:
            try:
                start, end = p.split("-", 1)
                port_list.extend(range(int(start), int(end) + 1))
            except ValueError:
                continue
        else:
            try:
                port_list.append(int(p))
            except ValueError:
                continue

    if not port_list:
        return ResponseModel(success=False, message="没有有效的端口")

    open_ports = []
    closed_ports = []

    def _scan_port(port):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((target, port))
            sock.close()
            return port, result == 0
        except Exception:
            return port, False

    # 并发扫描
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(_scan_port, p): p for p in port_list}
        for future in concurrent.futures.as_completed(futures):
            port, is_open = future.result()
            if is_open:
                open_ports.append(port)
            else:
                closed_ports.append(port)

    open_ports.sort()
    closed_ports.sort()

    return ResponseModel(
        success=True,
        data={
            "target": target,
            "open_ports": open_ports,
            "closed_ports": closed_ports,
            "total_scanned": len(port_list),
            "output": f"开放端口 ({len(open_ports)}): {', '.join(map(str, open_ports))}\n扫描端口总数: {len(port_list)}",
        },
    )
