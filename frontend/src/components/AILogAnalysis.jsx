import { useState, useEffect } from "react";
import {
  Card, Button, Select, Input, Upload, message, Tabs, Tag, Typography,
  Empty, Spin, Modal, Divider, Alert,
} from "antd";
import {
  ThunderboltOutlined, UploadOutlined, FileTextOutlined,
  DeleteOutlined, EyeOutlined, ExclamationCircleOutlined,
  CloudDownloadOutlined, SettingOutlined,
} from "@ant-design/icons";
import { aiAPI, inspectionAPI, backupAPI, deviceAPI } from "../services/api";
import { useAIStatus } from "../hooks/useAIStatus";
import dayjs from "dayjs";

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Dragger } = Upload;

export default function AILogAnalysis() {
  const { aiEnabled, requireAI, checkStatus } = useAIStatus();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [inputMode, setInputMode] = useState("manual"); // manual | inspection | backup | upload | device_log
  const [logContent, setLogContent] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [inspectionRecords, setInspectionRecords] = useState([]);
  const [backupRecords, setBackupRecords] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);

  // 设备日志查询相关
  const [logType, setLogType] = useState("syslog");
  const [logLines, setLogLines] = useState(100);
  const [queryingLog, setQueryingLog] = useState(false);
  const [deviceLogResult, setDeviceLogResult] = useState(null);

  const fetchDevices = async () => {
    try {
      const data = await deviceAPI.getDevices({ limit: 1000 });
      setDevices(data || []);
    } catch (error) { /* 静默 */ }
  };

  const fetchRecords = async () => {
    try {
      const data = await aiAPI.getAnalysisRecords();
      setRecords(data || []);
    } catch (error) { /* 静默 */ }
  };

  useEffect(() => {
    fetchDevices();
    fetchRecords();
  }, []);

  const handleDeviceChange = async (deviceId) => {
    setSelectedDevice(deviceId);
    setSelectedSource(null);
    setLogContent("");
    setDeviceLogResult(null);
    if (!deviceId) return;
    try {
      const [inspRes, backupRes] = await Promise.all([
        inspectionAPI.getRecords({ device_id: deviceId, limit: 50 }),
        backupAPI.getBackups({ device_id: deviceId }),
      ]);
      setInspectionRecords(inspRes || []);
      setBackupRecords(backupRes || []);
    } catch (error) { /* 静默 */ }
  };

  const handleSourceSelect = (type, record) => {
    setSelectedSource({ type, id: record.id });
    if (type === "inspection") {
      setLogContent(record.command_output || "");
    } else if (type === "backup") {
      setLogContent(record.content || "");
    }
  };

  // 查询设备日志
  const handleQueryDeviceLog = async () => {
    if (!selectedDevice) {
      message.warning("请先选择设备");
      return;
    }
    setQueryingLog(true);
    setDeviceLogResult(null);
    try {
      const result = await deviceAPI.queryDeviceLogs(selectedDevice, logType, logLines);
      if (result.success) {
        setDeviceLogResult(result.data);
        setLogContent(result.data.log_content || "");
        message.success("设备日志查询成功");
      } else {
        message.error(result.message || "日志查询失败");
      }
    } catch (error) {
      message.error("日志查询失败: " + (error.message || "未知错误"));
    } finally {
      setQueryingLog(false);
    }
  };

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogContent(e.target.result);
      message.success("文件读取成功");
    };
    reader.onerror = () => message.error("文件读取失败");
    reader.readAsText(file);
    return false;
  };

  const handleAnalyze = async () => {
    if (!requireAI()) return;
    if (!logContent.trim()) {
      message.warning("请输入或选择要分析的日志内容");
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const deviceId = selectedDevice || (devices.length > 0 ? devices[0].id : 1);
      const result = await aiAPI.analyzeLog(deviceId, logContent);
      if (result.success) {
        setAnalysisResult(result.data);
        fetchRecords();
      } else {
        message.error(result.message || "分析失败");
      }
    } catch (error) {
      message.error("分析失败: " + (error.message || "未知错误"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setLogContent("");
    setAnalysisResult(null);
    setSelectedSource(null);
    setDeviceLogResult(null);
  };

  // 来源选择面板（巡检/备份）
  const renderSourcePanel = () => {
    if (!selectedDevice) {
      return (
        <Empty
          description="请先选择设备"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: "32px 0" }}
        />
      );
    }

    return (
      <Tabs
        size="small"
        items={[
          {
            key: "inspection",
            label: `巡检结果 (${inspectionRecords.length})`,
            children: inspectionRecords.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {inspectionRecords.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleSourceSelect("inspection", r)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      marginBottom: 4,
                      background:
                        selectedSource?.type === "inspection" && selectedSource?.id === r.id
                          ? "#eef2ff"
                          : "transparent",
                      border:
                        selectedSource?.type === "inspection" && selectedSource?.id === r.id
                          ? "1px solid #6366f1"
                          : "1px solid transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong style={{ fontSize: 13 }}>{r.command_name}</Text>
                      <Tag color={r.status === "success" ? "success" : "error"} size="small">
                        {r.status === "success" ? "成功" : "失败"}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {r.device_name} | {r.created_at ? dayjs(r.created_at).format("MM-DD HH:mm") : "-"}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无巡检记录" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "24px 0" }} />
            ),
          },
          {
            key: "backup",
            label: `配置备份 (${backupRecords.length})`,
            children: backupRecords.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {backupRecords.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleSourceSelect("backup", b)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      marginBottom: 4,
                      background:
                        selectedSource?.type === "backup" && selectedSource?.id === b.id
                          ? "#eef2ff"
                          : "transparent",
                      border:
                        selectedSource?.type === "backup" && selectedSource?.id === b.id
                          ? "1px solid #6366f1"
                          : "1px solid transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong style={{ fontSize: 13 }}>
                        {b.backup_type === "running-config" ? "运行配置" : "启动配置"}
                      </Text>
                      <Tag color={b.status === "success" ? "success" : "error"} size="small">
                        {b.status === "success" ? "成功" : "失败"}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {b.device_name} | {b.created_at ? dayjs(b.created_at).format("MM-DD HH:mm") : "-"}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无备份记录" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "24px 0" }} />
            ),
          },
        ]}
      />
    );
  };

  // 设备日志查询面板
  const renderDeviceLogPanel = () => {
    if (!selectedDevice) {
      return (
        <Empty
          description="请先选择设备"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: "32px 0" }}
        />
      );
    }

    const device = devices.find((d) => d.id === selectedDevice);

    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            已选择设备：<Text strong>{device?.name} ({device?.ip_address})</Text>
          </Text>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Select
              value={logType}
              onChange={setLogType}
              style={{ width: 140 }}
              size="small"
            >
              <Select.Option value="syslog">系统日志</Select.Option>
              <Select.Option value="interface">接口状态</Select.Option>
              <Select.Option value="error">错误日志</Select.Option>
              <Select.Option value="all">全部日志</Select.Option>
            </Select>
            <Select
              value={logLines}
              onChange={setLogLines}
              style={{ width: 120 }}
              size="small"
            >
              <Select.Option value={50}>最近50行</Select.Option>
              <Select.Option value={100}>最近100行</Select.Option>
              <Select.Option value={200}>最近200行</Select.Option>
              <Select.Option value={500}>最近500行</Select.Option>
            </Select>
            <Button
              type="primary"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={handleQueryDeviceLog}
              loading={queryingLog}
              style={{ background: "#6366f1", borderColor: "#6366f1" }}
            >
              查询日志
            </Button>
          </div>
        </div>

        {deviceLogResult && (
          <div style={{ marginTop: 8 }}>
            <Alert
              message={
                <span>
                  查询成功 · 执行命令: <Text code>{deviceLogResult.command}</Text> · 
                  获取 <Text strong>{deviceLogResult.log_content?.split('\n').length || 0}</Text> 行日志
                </span>
              }
              type="success"
              showIcon
              style={{ borderRadius: 8, fontSize: 12 }}
            />
          </div>
        )}

        {queryingLog && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spin />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>正在连接设备查询日志...</Text>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* AI 服务状态提示 */}
      {!aiEnabled && (
        <Alert
          message="AI 服务未启用"
          description="请先在「配置管理」中配置 API 密钥并启用 AI 服务，才能使用日志分析和 AI 对话功能。"
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={checkStatus}>
              刷新状态
            </Button>
          }
        />
      )}

      <div style={{ display: "flex", gap: 20 }}>
        {/* 左侧：输入区 */}
        <div style={{ flex: 1 }}>
          <Card
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileTextOutlined style={{ color: "#6366f1" }} />
                <span>日志输入</span>
              </span>
            }
            bordered={false}
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: "16px 24px" }}
          >
            {/* 输入方式切换 */}
            <Tabs
              activeKey={inputMode}
              onChange={(key) => {
                setInputMode(key);
                setLogContent("");
                setSelectedSource(null);
                setDeviceLogResult(null);
              }}
              size="small"
              style={{ marginBottom: 12 }}
              items={[
                { key: "manual", label: "手动输入" },
                { key: "device_log", label: "设备日志" },
                { key: "inspection", label: "巡检结果" },
                { key: "backup", label: "配置备份" },
                { key: "upload", label: "上传文件" },
              ]}
            />

            {/* 设备选择（设备日志/巡检/备份模式） */}
            {(inputMode === "inspection" || inputMode === "backup" || inputMode === "device_log") && (
              <Select
                placeholder="选择设备"
                style={{ width: "100%", marginBottom: 12 }}
                onChange={handleDeviceChange}
                value={selectedDevice}
                showSearch
                optionFilterProp="label"
              >
                {devices.map((d) => (
                  <Select.Option key={d.id} value={d.id} label={`${d.name} (${d.ip_address})`}>
                    {d.name} ({d.ip_address})
                  </Select.Option>
                ))}
              </Select>
            )}

            {/* 设备日志查询面板 */}
            {inputMode === "device_log" && renderDeviceLogPanel()}

            {/* 来源选择（巡检/备份） */}
            {(inputMode === "inspection" || inputMode === "backup") && renderSourcePanel()}

            {/* 手动输入 */}
            {inputMode === "manual" && (
              <TextArea
                rows={12}
                placeholder="请输入设备日志内容，AI 将为您分析..."
                value={logContent}
                onChange={(e) => setLogContent(e.target.value)}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
            )}

            {/* 文件上传 */}
            {inputMode === "upload" && (
              <Dragger
                accept=".txt,.log,.cfg,.conf,.md"
                beforeUpload={handleFileUpload}
                showUploadList={false}
                style={{ padding: "24px 0" }}
              >
                <p style={{ fontSize: 32, color: "#6366f1", marginBottom: 8 }}><UploadOutlined /></p>
                <Text style={{ fontSize: 15 }}>点击或拖拽文件到此处上传</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  支持 .txt / .log / .cfg / .conf / .md 格式
                </Text>
              </Dragger>
            )}

            {/* 已选内容预览 */}
            {logContent && (inputMode === "inspection" || inputMode === "backup" || inputMode === "upload" || inputMode === "device_log") && (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已加载内容（{logContent.length} 字符）
                </Text>
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                    maxHeight: 120,
                    overflowY: "auto",
                    fontFamily: "monospace",
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {logContent.slice(0, 500)}{logContent.length > 500 ? "\n..." : ""}
                </div>
              </>
            )}

            {/* 操作按钮 */}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleAnalyze}
                loading={analyzing}
                disabled={!aiEnabled || !logContent.trim()}
                style={{ minWidth: 120 }}
              >
                {analyzing ? "分析中..." : "开始分析"}
              </Button>
              <Button icon={<DeleteOutlined />} onClick={handleClear} disabled={!logContent}>
                清空
              </Button>
            </div>
          </Card>

          {/* 分析结果 */}
          {(analysisResult || analyzing) && (
            <Card
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ThunderboltOutlined style={{ color: "#6366f1" }} />
                  <span>分析结果</span>
                </span>
              }
              bordered={false}
              style={{ borderRadius: 16, marginTop: 16 }}
              bodyStyle={{ padding: "16px 24px" }}
            >
              {analyzing ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary">AI 正在分析中，请稍候...</Text>
                  </div>
                </div>
              ) : analysisResult ? (
                <div>
                  {analysisResult.severity && (
                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ marginRight: 8 }}>严重程度:</Text>
                      <Tag
                        color={
                          analysisResult.severity === "critical" ? "red" :
                          analysisResult.severity === "high" ? "orange" :
                          analysisResult.severity === "medium" ? "gold" :
                          analysisResult.severity === "low" ? "blue" : "green"
                        }
                      >
                        {analysisResult.severity}
                      </Tag>
                    </div>
                  )}
                  <div
                    style={{
                      padding: 16,
                      background: "#f8fafc",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      fontSize: 14,
                      lineHeight: 1.8,
                    }}
                  >
                    {analysisResult.analysis || analysisResult.analysis_result || JSON.stringify(analysisResult, null, 2)}
                  </div>
                  {analysisResult.recommendations && (
                    <div style={{ marginTop: 12 }}>
                      <Text strong>建议操作：</Text>
                      <div style={{ marginTop: 4, padding: 12, background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a" }}>
                        {analysisResult.recommendations}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          )}
        </div>

        {/* 右侧：历史记录 */}
        <div style={{ width: 360 }}>
          <Card
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileTextOutlined style={{ color: "#6366f1" }} />
                <span>分析记录</span>
              </span>
            }
            bordered={false}
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: "16px" }}
          >
            {records.length > 0 ? (
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {records.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "12px",
                      borderRadius: 10,
                      marginBottom: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onClick={() => {
                      Modal.info({
                        title: "分析结果详情",
                        content: (
                          <div>
                            <div style={{ marginBottom: 12 }}>
                              <Text type="secondary">
                                {r.device_name} | {r.created_at ? dayjs(r.created_at).format("YYYY-MM-DD HH:mm") : "-"}
                              </Text>
                              <Tag
                                color={
                                  r.severity === "critical" ? "red" :
                                  r.severity === "high" ? "orange" :
                                  r.severity === "medium" ? "gold" :
                                  r.severity === "low" ? "blue" : "green"
                                }
                                style={{ marginLeft: 8 }}
                              >
                                {r.severity}
                              </Tag>
                            </div>
                            <pre style={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              background: "#f8fafc",
                              padding: 12,
                              borderRadius: 8,
                              maxHeight: 400,
                              overflowY: "auto",
                              fontSize: 13,
                              lineHeight: 1.6,
                            }}>
                              {r.analysis_result || "无结果"}
                            </pre>
                            {r.recommendations && (
                              <div style={{ marginTop: 12 }}>
                                <Text strong>建议：</Text>
                                <div style={{ padding: 8, background: "#fffbeb", borderRadius: 6, marginTop: 4 }}>
                                  {r.recommendations}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                        width: 700,
                        okText: "关闭",
                      });
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong style={{ fontSize: 13 }}>{r.device_name || "未知设备"}</Text>
                      <Tag
                        color={
                          r.severity === "critical" ? "red" :
                          r.severity === "high" ? "orange" :
                          r.severity === "medium" ? "gold" :
                          r.severity === "low" ? "blue" : "green"
                        }
                        size="small"
                      >
                        {r.severity}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {r.created_at ? dayjs(r.created_at).format("MM-DD HH:mm") : "-"}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无分析记录" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "32px 0" }} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
