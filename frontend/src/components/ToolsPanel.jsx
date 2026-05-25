import { useState } from "react";
import {
  Card, Button, Input, InputNumber, Select, message, Tabs, Typography, Row, Col,
  Space, Tag, Divider, Alert, Spin, Empty, Statistic, Progress, Table,
} from "antd";
import {
  ApiOutlined, GlobalOutlined, ThunderboltOutlined, SearchOutlined,
  PlayCircleOutlined, ClearOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WifiOutlined, SafetyCertificateOutlined, CopyOutlined,
} from "@ant-design/icons";
import { toolsAPI, deviceAPI } from "../services/api";

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function ToolsPanel() {
  const [activeTab, setActiveTab] = useState("ping");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [devices, setDevices] = useState([]);

  // Ping
  const [pingTarget, setPingTarget] = useState("");
  const [pingCount, setPingCount] = useState(4);
  const [pingHistory, setPingHistory] = useState([]);

  // Batch Ping
  const [batchPingTargets, setBatchPingTargets] = useState("");

  // Traceroute
  const [traceTarget, setTraceTarget] = useState("");
  const [traceFromDevice, setTraceFromDevice] = useState(null);

  // TCPing
  const [tcpTarget, setTcpTarget] = useState("");
  const [tcpPort, setTcpPort] = useState(80);
  const [tcpCount, setTcpCount] = useState(4);

  // UDPing
  const [udpTarget, setUdpTarget] = useState("");
  const [udpPort, setUdpPort] = useState(53);
  const [udpCount, setUdpCount] = useState(4);

  // DNS
  const [dnsDomain, setDnsDomain] = useState("");
  const [dnsServer, setDnsServer] = useState("");
  const [batchDnsDomains, setBatchDnsDomains] = useState("");

  // Whois
  const [whoisDomain, setWhoisDomain] = useState("");

  // Port Scan
  const [scanTarget, setScanTarget] = useState("");
  const [scanPorts, setScanPorts] = useState("22,23,80,443,3389,8080");

  const fetchDevices = async () => {
    try {
      const data = await deviceAPI.getDevices({ limit: 1000 });
      setDevices(data || []);
    } catch (error) { /* 静默 */ }
  };

  const handleExecute = async (toolType) => {
    setLoading(true);
    setResult(null);
    try {
      let res;
      switch (toolType) {
        case "ping":
          if (!pingTarget.trim()) { message.warning("请输入目标地址"); setLoading(false); return; }
          res = await toolsAPI.ping(pingTarget.trim(), pingCount);
          if (res.success && res.data) {
            setPingHistory((prev) => [{
              id: Date.now(),
              target: pingTarget.trim(),
              time: new Date().toLocaleTimeString(),
              stats: res.data.stats || {},
              success: res.data.success,
            }, ...prev].slice(0, 20));
          }
          break;
        case "batchping":
          if (!batchPingTargets.trim()) { message.warning("请输入目标地址列表"); setLoading(false); return; }
          const targets = batchPingTargets.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
          if (targets.length === 0) { message.warning("请输入至少一个目标地址"); setLoading(false); return; }
          if (targets.length > 50) { message.warning("批量 Ping 最多支持 50 个目标"); setLoading(false); return; }
          res = await toolsAPI.batchPing(targets, pingCount);
          break;
        case "traceroute":
          if (!traceTarget.trim()) { message.warning("请输入目标地址"); setLoading(false); return; }
          if (traceFromDevice) {
            res = await toolsAPI.deviceTraceroute(traceFromDevice, traceTarget.trim());
          } else {
            res = await toolsAPI.traceroute(traceTarget.trim());
          }
          break;
        case "tcping":
          if (!tcpTarget.trim()) { message.warning("请输入目标地址"); setLoading(false); return; }
          res = await toolsAPI.tcpPing(tcpTarget.trim(), tcpPort, tcpCount);
          break;
        case "udpping":
          if (!udpTarget.trim()) { message.warning("请输入目标地址"); setLoading(false); return; }
          res = await toolsAPI.udpPing(udpTarget.trim(), udpPort, udpCount);
          break;
        case "dns":
          if (!dnsDomain.trim()) { message.warning("请输入域名"); setLoading(false); return; }
          res = await toolsAPI.dns(dnsDomain.trim(), dnsServer.trim() || undefined);
          break;
        case "batchdns":
          if (!batchDnsDomains.trim()) { message.warning("请输入域名列表"); setLoading(false); return; }
          const domains = batchDnsDomains.split(/[\n,]/).map((d) => d.trim()).filter(Boolean);
          if (domains.length === 0) { message.warning("请输入至少一个域名"); setLoading(false); return; }
          res = await toolsAPI.batchDns(domains, dnsServer.trim() || undefined);
          break;
        case "whois":
          if (!whoisDomain.trim()) { message.warning("请输入域名"); setLoading(false); return; }
          res = await toolsAPI.whois(whoisDomain.trim());
          break;
        case "portscan":
          if (!scanTarget.trim()) { message.warning("请输入目标地址"); setLoading(false); return; }
          res = await toolsAPI.portScan(scanTarget.trim(), scanPorts);
          break;
        default:
          break;
      }
      setResult({ tool: toolType, ...res });
    } catch (error) {
      message.error("执行失败: " + (error.message || "未知错误"));
      setResult({ tool: toolType, success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 格式化 whois 输出为可读的键值对
  const formatWhoisOutput = (output) => {
    if (!output) return <Text type="secondary">无数据</Text>;
    const lines = output.split('\n').filter(line => line.trim() && !line.trim().startsWith('%') && !line.trim().startsWith('#'));
    const items = [];
    lines.forEach((line, idx) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key && value) {
          items.push(
            <div key={idx} style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
              <Text strong style={{ minWidth: 160, fontSize: 13, color: '#475569' }}>{key}:</Text>
              <Text style={{ fontSize: 13, color: '#1e293b', flex: 1 }}>{value}</Text>
            </div>
          );
        }
      }
    });
    if (items.length === 0) {
      // 如果没有解析出键值对，直接展示原始文本
      return (
        <pre style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontFamily: 'inherit' }}>
          {output}
        </pre>
      );
    }
    return items;
  };

  const renderResult = () => {
    if (!result) return null;
    const data = result.data || {};
    const stats = data.stats || {};

    // 批量结果
    if (data.results) {
      return (
        <Card bordered={false} style={{ borderRadius: 16, marginTop: 16 }} bodyStyle={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CheckCircleOutlined style={{ color: "#10b981", fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>批量执行完成</Text>
            <Tag color="success">{data.success_count} 成功</Tag>
            {data.failed_count > 0 && <Tag color="error">{data.failed_count} 失败</Tag>}
          </div>
          <Table
            size="small"
            pagination={false}
            dataSource={data.results.map((r, i) => ({ key: i, ...r }))}
            columns={[
              {
                title: result.tool === "batchping" ? "目标" : "域名",
                dataIndex: result.tool === "batchping" ? "target" : "domain",
                key: "target",
                render: (t) => <Text strong>{t}</Text>,
              },
              {
                title: "状态",
                dataIndex: "success",
                key: "success",
                render: (s) => <Tag color={s ? "success" : "error"}>{s ? "成功" : "失败"}</Tag>,
              },
              {
                title: "详情",
                dataIndex: "data",
                key: "data",
                render: (d) => {
                  if (!d) return <Text type="secondary">{result.message || "—"}</Text>;
                  if (result.tool === "batchping") {
                    const s = d.stats || {};
                    return (
                      <Text style={{ fontSize: 12 }}>
                        {s.avg_ms ? `平均 ${s.avg_ms}ms` : "—"}
                        {s.loss_percent !== undefined ? ` | 丢包 ${s.loss_percent}%` : ""}
                      </Text>
                    );
                  }
                  return <Text style={{ fontSize: 12 }}>{d.output?.slice(0, 100) || "—"}</Text>;
                },
              },
            ]}
          />
        </Card>
      );
    }

    return (
      <Card bordered={false} style={{ borderRadius: 16, marginTop: 16 }} bodyStyle={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {result.success ? (
            <CheckCircleOutlined style={{ color: "#10b981", fontSize: 18 }} />
          ) : (
            <CloseCircleOutlined style={{ color: "#ef4444", fontSize: 18 }} />
          )}
          <Text strong style={{ fontSize: 15 }}>{result.success ? "执行成功" : "执行失败"}</Text>
        </div>

        {/* 统计信息 */}
        {Object.keys(stats).length > 0 && (
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            {stats.avg_ms !== undefined && (
              <Col span={6}>
                <div style={{ padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>平均延迟</Text>
                  <div><Text strong style={{ fontSize: 18, color: "#10b981" }}>{stats.avg_ms}ms</Text></div>
                </div>
              </Col>
            )}
            {stats.min_ms !== undefined && (
              <Col span={6}>
                <div style={{ padding: "8px 12px", background: "#eff6ff", borderRadius: 8, textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>最小延迟</Text>
                  <div><Text strong style={{ fontSize: 18, color: "#3b82f6" }}>{stats.min_ms}ms</Text></div>
                </div>
              </Col>
            )}
            {stats.max_ms !== undefined && (
              <Col span={6}>
                <div style={{ padding: "8px 12px", background: "#fef3c7", borderRadius: 8, textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>最大延迟</Text>
                  <div><Text strong style={{ fontSize: 18, color: "#f59e0b" }}>{stats.max_ms}ms</Text></div>
                </div>
              </Col>
            )}
            {stats.loss_percent !== undefined && (
              <Col span={6}>
                <div style={{ padding: "8px 12px", background: stats.loss_percent > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: 8, textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>丢包率</Text>
                  <div><Text strong style={{ fontSize: 18, color: stats.loss_percent > 0 ? "#ef4444" : "#10b981" }}>{stats.loss_percent}%</Text></div>
                </div>
              </Col>
            )}
            {stats.success_rate !== undefined && (
              <Col span={6}>
                <div style={{ padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>成功率</Text>
                  <div><Text strong style={{ fontSize: 18, color: "#10b981" }}>{stats.success_rate}%</Text></div>
                </div>
              </Col>
            )}
            {stats.open_ports && (
              <Col span={24}>
                <div style={{ padding: "8px 12px", background: "#f0fdf4", borderRadius: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>开放端口</Text>
                  <div style={{ marginTop: 4 }}>
                    {stats.open_ports.length > 0 ? (
                      stats.open_ports.map((p) => <Tag key={p} color="success" style={{ margin: 2 }}>{p}</Tag>)
                    ) : (
                      <Text type="secondary">无开放端口</Text>
                    )}
                  </div>
                </div>
              </Col>
            )}
          </Row>
        )}

        {/* 路由追踪跳数 */}
        {data.hops && data.hops.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 13 }}>路由跳数 ({data.hops.length} 跳)</Text>
            <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <Table
                size="small"
                pagination={false}
                showHeader={false}
                dataSource={data.hops.map((h) => ({ key: h.hop, ...h }))}
                columns={[
                  {
                    title: "跳数",
                    dataIndex: "hop",
                    key: "hop",
                    width: 60,
                    render: (n) => <Tag color="indigo" style={{ minWidth: 28, textAlign: "center", fontSize: 11 }}>{n}</Tag>,
                  },
                  {
                    title: "信息",
                    dataIndex: "info",
                    key: "info",
                    render: (t) => <Text style={{ fontSize: 12, fontFamily: "monospace" }}>{t}</Text>,
                  },
                ]}
              />
            </div>
          </div>
        )}

        {/* Whois 格式化展示 */}
        {data.output && result.tool === "whois" && (
          <>
            <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
              Whois 查询结果
              {data.domain && <Tag color="pink" style={{ marginLeft: 8 }}>{data.domain}</Tag>}
              {data.source && <Tag color="default" style={{ marginLeft: 4 }}>来源: {data.source}</Tag>}
            </Text>
            <div
              style={{
                padding: 16,
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                maxHeight: 400,
                overflowY: "auto",
              }}
            >
              {formatWhoisOutput(data.output)}
            </div>
            {data.note && (
              <Alert message={data.note} type="info" showIcon style={{ marginTop: 8, borderRadius: 8 }} />
            )}
          </>
        )}

        {/* 原始输出（非 whois） */}
        {data.output && result.tool !== "whois" && (
          <>
            <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>详细输出</Text>
            <pre
              style={{
                padding: 12,
                background: "#1e293b",
                color: "#e2e8f0",
                borderRadius: 8,
                maxHeight: 300,
                overflowY: "auto",
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: "Consolas, 'Courier New', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {data.output}
            </pre>
          </>
        )}

        {!data.output && result.message && (
          <Alert
            message={result.message}
            type={result.success ? "success" : "error"}
            showIcon
            style={{ borderRadius: 8 }}
          />
        )}
      </Card>
    );
  };

  // Ping 历史记录表格列
  const pingHistoryColumns = [
    { title: "目标", dataIndex: "target", key: "target", render: (t) => <Text strong style={{ fontSize: 12 }}>{t}</Text> },
    { title: "时间", dataIndex: "time", key: "time", width: 90, render: (t) => <Text style={{ fontSize: 11, color: "#94a3b8" }}>{t}</Text> },
    {
      title: "平均延迟", dataIndex: "stats", key: "avg", width: 90,
      render: (s) => s.avg_ms ? <Text style={{ fontSize: 12, color: "#10b981" }}>{s.avg_ms}ms</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "丢包率", dataIndex: "stats", key: "loss", width: 80,
      render: (s) => s.loss_percent !== undefined ? (
        <Text style={{ fontSize: 12, color: s.loss_percent > 0 ? "#ef4444" : "#10b981" }}>{s.loss_percent}%</Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: "状态", dataIndex: "success", key: "status", width: 60,
      render: (s) => <Tag color={s ? "success" : "error"} size="small">{s ? "成功" : "失败"}</Tag>,
    },
  ];

  const tools = [
    {
      key: "ping",
      label: "Ping 测试",
      icon: <WifiOutlined />,
      color: "#10b981",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>目标地址 (IP 或域名)</Text>
            <Input placeholder="例如：8.8.8.8 或 google.com" value={pingTarget} onChange={(e) => setPingTarget(e.target.value)} onPressEnter={() => handleExecute("ping")} size="large" />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>发送次数</Text>
            <InputNumber min={1} max={20} value={pingCount} onChange={setPingCount} style={{ width: "100%" }} size="large" />
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("ping")} loading={loading} block size="large" style={{ background: "#10b981", borderColor: "#10b981" }}>
            开始 Ping 测试
          </Button>

          {/* Ping 历史记录 */}
          {pingHistory.length > 0 && (
            <>
              <Divider style={{ margin: "8px 0" }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Ping 历史记录 ({pingHistory.length})</Text>
              </Divider>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <Table size="small" pagination={false} showHeader={false} dataSource={pingHistory} columns={pingHistoryColumns} />
              </div>
            </>
          )}
        </Space>
      ),
    },
    {
      key: "batchping",
      label: "批量 Ping",
      icon: <WifiOutlined />,
      color: "#059669",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>目标地址列表（每行一个或用逗号分隔，最多 50 个）</Text>
            <TextArea
              rows={6}
              placeholder={"8.8.8.8\n114.114.114.114\ngoogle.com\nbaidu.com"}
              value={batchPingTargets}
              onChange={(e) => setBatchPingTargets(e.target.value)}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>每个目标发送次数</Text>
            <InputNumber min={1} max={10} value={pingCount} onChange={setPingCount} style={{ width: "100%" }} size="large" />
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("batchping")} loading={loading} block size="large" style={{ background: "#059669", borderColor: "#059669" }}>
            开始批量 Ping
          </Button>
        </Space>
      ),
    },
    {
      key: "traceroute",
      label: "路由追踪",
      icon: <GlobalOutlined />,
      color: "#6366f1",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>目标地址 (IP 或域名)</Text>
            <Input placeholder="例如：8.8.8.8 或 google.com" value={traceTarget} onChange={(e) => setTraceTarget(e.target.value)} onPressEnter={() => handleExecute("traceroute")} size="large" />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>追踪来源</Text>
            <Select
              placeholder="从服务器端追踪"
              allowClear
              value={traceFromDevice}
              onChange={setTraceFromDevice}
              style={{ width: "100%" }}
              size="large"
              onDropdownVisibleChange={(open) => open && fetchDevices()}
            >
              {devices.map((d) => (
                <Option key={d.id} value={d.id}>{d.name} ({d.ip_address})</Option>
              ))}
            </Select>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
              选择设备将从设备端发起追踪，留空则从服务器端追踪
            </Text>
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("traceroute")} loading={loading} block size="large">
            开始路由追踪
          </Button>
        </Space>
      ),
    },
    {
      key: "tcping",
      label: "TCPing",
      icon: <ThunderboltOutlined />,
      color: "#f59e0b",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>目标地址 (IP 或域名)</Text>
            <Input placeholder="例如：8.8.8.8" value={tcpTarget} onChange={(e) => setTcpTarget(e.target.value)} size="large" />
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>端口</Text>
              <InputNumber min={1} max={65535} value={tcpPort} onChange={setTcpPort} style={{ width: "100%" }} size="large" />
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>次数</Text>
              <InputNumber min={1} max={20} value={tcpCount} onChange={setTcpCount} style={{ width: "100%" }} size="large" />
            </Col>
          </Row>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("tcping")} loading={loading} block size="large" style={{ background: "#f59e0b", borderColor: "#f59e0b" }}>
            开始 TCPing
          </Button>
        </Space>
      ),
    },
    {
      key: "udpping",
      label: "UDPing",
      icon: <WifiOutlined />,
      color: "#06b6d4",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>目标地址 (IP 或域名)</Text>
            <Input placeholder="例如：8.8.8.8" value={udpTarget} onChange={(e) => setUdpTarget(e.target.value)} size="large" />
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>端口</Text>
              <InputNumber min={1} max={65535} value={udpPort} onChange={setUdpPort} style={{ width: "100%" }} size="large" />
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>次数</Text>
              <InputNumber min={1} max={20} value={udpCount} onChange={setUdpCount} style={{ width: "100%" }} size="large" />
            </Col>
          </Row>
          <Alert message="UDP 测试说明" description="UDP 是无连接协议，无响应不代表端口关闭，可能只是不回复。超时时间自动限制为最多 5 秒。" type="info" showIcon style={{ borderRadius: 8 }} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("udpping")} loading={loading} block size="large" style={{ background: "#06b6d4", borderColor: "#06b6d4" }}>
            开始 UDPing
          </Button>
        </Space>
      ),
    },
    {
      key: "dns",
      label: "DNS 查询",
      icon: <SearchOutlined />,
      color: "#8b5cf6",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>域名</Text>
            <Input placeholder="例如：google.com" value={dnsDomain} onChange={(e) => setDnsDomain(e.target.value)} onPressEnter={() => handleExecute("dns")} size="large" />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>DNS 服务器（可选）</Text>
            <Input placeholder="例如：8.8.8.8，留空使用系统默认" value={dnsServer} onChange={(e) => setDnsServer(e.target.value)} size="large" />
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("dns")} loading={loading} block size="large" style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}>
            查询 DNS
          </Button>
        </Space>
      ),
    },
    {
      key: "batchdns",
      label: "批量 DNS",
      icon: <SearchOutlined />,
      color: "#7c3aed",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>域名列表（每行一个或用逗号分隔）</Text>
            <TextArea
              rows={6}
              placeholder={"google.com\nbaidu.com\ncloudflare.com"}
              value={batchDnsDomains}
              onChange={(e) => setBatchDnsDomains(e.target.value)}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>DNS 服务器（可选）</Text>
            <Input placeholder="例如：8.8.8.8，留空使用系统默认" value={dnsServer} onChange={(e) => setDnsServer(e.target.value)} size="large" />
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("batchdns")} loading={loading} block size="large" style={{ background: "#7c3aed", borderColor: "#7c3aed" }}>
            批量查询 DNS
          </Button>
        </Space>
      ),
    },
    {
      key: "whois",
      label: "Whois 查询",
      icon: <SafetyCertificateOutlined />,
      color: "#ec4899",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>域名</Text>
            <Input placeholder="例如：google.com" value={whoisDomain} onChange={(e) => setWhoisDomain(e.target.value)} onPressEnter={() => handleExecute("whois")} size="large" />
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("whois")} loading={loading} block size="large" style={{ background: "#ec4899", borderColor: "#ec4899" }}>
            查询 Whois
          </Button>
        </Space>
      ),
    },
    {
      key: "portscan",
      label: "端口扫描",
      icon: <ApiOutlined />,
      color: "#ef4444",
      render: (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>目标地址 (IP 或域名)</Text>
            <Input placeholder="例如：192.168.1.1" value={scanTarget} onChange={(e) => setScanTarget(e.target.value)} size="large" />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>端口范围</Text>
            <Input placeholder="例如：22,80,443 或 1-1024" value={scanPorts} onChange={(e) => setScanPorts(e.target.value)} size="large" />
            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
              支持单个端口（22）、多个端口（22,80,443）、范围（1-1024）
            </Text>
          </div>
          <Alert message="安全提示" description="端口扫描仅用于网络运维诊断，请确保您有权限扫描目标。" type="warning" showIcon style={{ borderRadius: 8 }} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleExecute("portscan")} loading={loading} block size="large" style={{ background: "#ef4444", borderColor: "#ef4444" }}>
            开始端口扫描
          </Button>
        </Space>
      ),
    },
  ];

  const activeTool = tools.find((t) => t.key === activeTab);

  return (
    <div>
      <Row gutter={[20, 20]}>
        {/* 左侧工具列表 */}
        <Col span={5}>
          <Card bordered={false} style={{ borderRadius: 16 }} bodyStyle={{ padding: 8 }}>
            {tools.map((tool) => (
              <div
                key={tool.key}
                onClick={() => { setActiveTab(tool.key); setResult(null); }}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  marginBottom: 4,
                  background: activeTab === tool.key ? "#eef2ff" : "transparent",
                  border: activeTab === tool.key ? "1px solid #c7d2fe" : "1px solid transparent",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ color: tool.color, fontSize: 16 }}>{tool.icon}</span>
                <Text strong={activeTab === tool.key} style={{ fontSize: 14 }}>
                  {tool.label}
                </Text>
              </div>
            ))}
          </Card>
        </Col>

        {/* 右侧操作区 */}
        <Col span={19}>
          <Card bordered={false} style={{ borderRadius: 16 }} bodyStyle={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ color: activeTool?.color, fontSize: 20 }}>{activeTool?.icon}</span>
              <Title level={4} style={{ margin: 0, color: "#1e293b" }}>
                {activeTool?.label}
              </Title>
            </div>
            <Spin spinning={loading}>
              {activeTool?.render}
            </Spin>
            {renderResult()}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

