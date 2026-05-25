import { useState, useEffect, useRef } from "react";
import {
  Table, Button, Select, message, Space, Checkbox, Card, Typography, Tag, Tooltip,
  Row, Col, Divider, Alert, Progress, notification,
} from "antd";
import {
  PlayCircleOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { inspectionAPI, deviceAPI, groupAPI } from "../services/api";
import { DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS } from "../constants";

const { Option } = Select;
const { Text } = Typography;

export default function InspectionExecute({ onExecuted }) {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [executingDevices, setExecutingDevices] = useState(new Set());
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [groupFilter, setGroupFilter] = useState(null);

  // 运行模式：selected(选中设备) | group(按分组) | type(按设备类型) | category(按设备类别)
  const [runMode, setRunMode] = useState("selected");
  const [runGroupIds, setRunGroupIds] = useState([]);
  const [runDeviceType, setRunDeviceType] = useState(null);
  const [runDeviceCategory, setRunDeviceCategory] = useState(null);

  const fetchDevices = async () => {
    try {
      const params = groupFilter ? { group_id: groupFilter } : {};
      const data = await deviceAPI.getDevices(params);
      setDevices(data || []);
    } catch (error) {
      message.error("获取设备列表失败");
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await groupAPI.getGroups();
      setGroups(data || []);
    } catch (error) {
      message.error("获取分组列表失败");
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchGroups();
  }, [groupFilter]);

  const handleExecute = async (deviceId) => {
    setExecutingDevices((prev) => new Set([...prev, deviceId]));
    const device = devices.find((d) => d.id === deviceId);
    const deviceName = device?.name || `设备${deviceId}`;
    try {
      notification.info({
        message: '巡检执行中',
        description: `正在对 ${deviceName} 执行巡检，请稍候...`,
        duration: 3,
      });
      const result = await inspectionAPI.executeInspection(deviceId);
      if (result && result.success) {
        message.success(`巡检任务已提交: ${deviceName}`);
        onExecuted?.();
      } else {
        message.error(result?.message || `巡检提交失败: ${deviceName}`);
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || "未知错误";
      message.error(`巡检失败: ${deviceName} - ${errMsg}`);
    } finally {
      setExecutingDevices((prev) => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  const handleBatchExecute = async () => {
    if (selectedDevices.length === 0) {
      message.warning("请先在表格中勾选要巡检的设备");
      return;
    }
    setLoading(true);
    try {
      notification.info({
        message: '批量巡检执行中',
        description: `正在对 ${selectedDevices.length} 台设备执行巡检，请稍候...`,
        duration: 4,
      });
      const result = await inspectionAPI.executeBatchInspection({
        device_ids: selectedDevices,
      });
      if (result && result.success) {
        message.success(`批量巡检已提交，共 ${selectedDevices.length} 台设备`);
        setSelectedDevices([]);
        onExecuted?.();
      } else {
        message.error(result?.message || "批量巡检提交失败，请检查设备是否有效");
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || "批量巡检失败";
      message.error(`批量巡检失败: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunByGroup = async () => {
    if (runGroupIds.length === 0) {
      message.warning("请选择至少一个分组");
      return;
    }
    setLoading(true);
    try {
      notification.info({
        message: '分组巡检执行中',
        description: `正在对 ${runGroupIds.length} 个分组的设备执行巡检...`,
        duration: 4,
      });
      const result = await inspectionAPI.executeBatchInspection({
        group_ids: runGroupIds,
      });
      if (result && result.success) {
        message.success(`分组巡检已提交，共 ${result.data?.total || 0} 台设备`);
        onExecuted?.();
      } else {
        message.error(result?.message || "分组巡检提交失败");
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || "分组巡检失败";
      message.error(`分组巡检失败: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunByType = async () => {
    if (!runDeviceType && !runDeviceCategory) {
      message.warning("请选择设备类型或设备类别");
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (runDeviceType) params.device_type = runDeviceType;
      if (runDeviceCategory) params.device_category = runDeviceCategory;
      const typeDesc = [runDeviceType ? DEVICE_TYPE_OPTIONS.find(o => o.value === runDeviceType)?.label : '', runDeviceCategory ? DEVICE_CATEGORY_OPTIONS.find(o => o.value === runDeviceCategory)?.label : ''].filter(Boolean).join(' + ');
      notification.info({
        message: '类型巡检执行中',
        description: `正在对 ${typeDesc} 类型的设备执行巡检...`,
        duration: 4,
      });
      const result = await inspectionAPI.executeBatchInspection(params);
      if (result && result.success) {
        message.success(`巡检已提交，共 ${result.data?.total || 0} 台设备`);
        onExecuted?.();
      } else {
        message.error(result?.message || "巡检提交失败");
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || "巡检失败";
      message.error(`巡检失败: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = groupFilter
    ? devices.filter((d) => (d.group_ids || []).includes(groupFilter))
    : devices;

  // 当设备列表变化时，清理已不存在的设备选中状态
  const filteredDeviceIdsRef = useRef(new Set());
  useEffect(() => {
    const currentIds = new Set(filteredDevices.map((d) => d.id));
    const valid = selectedDevices.filter((id) => currentIds.has(id));
    if (valid.length !== selectedDevices.length) {
      setSelectedDevices(valid);
    }
    filteredDeviceIdsRef.current = currentIds;
  }, [filteredDevices]);

  const columns = [
    {
      title: (
        <Checkbox
          indeterminate={
            selectedDevices.length > 0 &&
            selectedDevices.length < filteredDevices.length
          }
          checked={
            filteredDevices.length > 0 &&
            selectedDevices.length === filteredDevices.length
          }
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedDevices(filteredDevices.map((d) => d.id));
            } else {
              setSelectedDevices([]);
            }
          }}
        />
      ),
      render: (_, record) => (
        <Checkbox
          checked={selectedDevices.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedDevices([...selectedDevices, record.id]);
            } else {
              setSelectedDevices(
                selectedDevices.filter((id) => id !== record.id)
              );
            }
          }}
        />
      ),
    },
    {
      title: "设备名称",
      dataIndex: "name",
      key: "name",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "IP地址",
      dataIndex: "ip_address",
      key: "ip_address",
    },
    {
      title: "设备类型",
      dataIndex: "device_type",
      key: "device_type",
      render: (type) => {
        const map = { huawei: "华为", h3c: "H3C", ruijie: "锐捷", cisco: "Cisco" };
        const colorMap = { huawei: "blue", h3c: "green", ruijie: "orange", cisco: "purple" };
        return <Tag color={colorMap[type] || "default"}>{map[type] || type}</Tag>;
      },
    },
    {
      title: "分组标签",
      dataIndex: "group_names",
      key: "group_names",
      render: (names) => {
        if (!names || names.length === 0) return <Text type="secondary">未分组</Text>;
        return (
          <Space size={4} wrap>
            {names.map((n, i) => (
              <Tag key={i} color="cyan">{n}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "connection_status",
      key: "connection_status",
      render: (status) => {
        const map = { success: { color: "green", text: "在线" }, failed: { color: "red", text: "离线" }, testing: { color: "orange", text: "检测中" }, unknown: { color: "default", text: "未知" } };
        const s = map[status] || map.unknown;
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Tooltip title="执行巡检">
          <Button
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={() => handleExecute(record.id)}
            loading={executingDevices.has(record.id)}
          >
            巡检
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      {/* 运行配置区 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 15, display: "block", marginBottom: 12 }}>
          🚀 巡检运行
        </Text>
        <Row gutter={[16, 12]}>
          {/* 选中设备模式 */}
          <Col span={24}>
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <Row align="middle" gutter={[12, 8]}>
                <Col>
                  <Text strong>选中设备</Text>
                </Col>
                <Col span={16}>
                  <Text type="secondary">
                    在下方表格中选择设备后点击执行，已选 <Text strong style={{ color: "#6366f1" }}>{selectedDevices.length}</Text> 台
                  </Text>
                </Col>
                <Col>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleBatchExecute}
                    loading={loading}
                    disabled={selectedDevices.length === 0}
                  >
                    执行选中设备巡检 ({selectedDevices.length})
                  </Button>
                </Col>
              </Row>
            </div>
          </Col>

          <Col span={24}>
            <Divider style={{ margin: "8px 0" }} />
          </Col>

          {/* 按分组模式 */}
          <Col span={24}>
            <div style={{ padding: "12px 16px", background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0" }}>
              <Row align="middle" gutter={[12, 8]}>
                <Col>
                  <Text strong>按分组执行</Text>
                </Col>
                <Col span={12}>
                  <Select
                    mode="multiple"
                    placeholder="选择要巡检的分组（可多选）"
                    value={runGroupIds}
                    onChange={setRunGroupIds}
                    style={{ width: "100%" }}
                  >
                    {groups.map((g) => (
                      <Option key={g.id} value={g.id}>
                        {g.name} ({g.device_count || 0}台)
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunByGroup}
                    loading={loading}
                    disabled={runGroupIds.length === 0}
                    style={{ background: "#10b981", borderColor: "#10b981", color: "#fff" }}
                  >
                    执行分组巡检
                  </Button>
                </Col>
              </Row>
            </div>
          </Col>

          {/* 按设备类型/类别模式 */}
          <Col span={24}>
            <div style={{ padding: "12px 16px", background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe" }}>
              <Row align="middle" gutter={[12, 8]}>
                <Col>
                  <Text strong>按类型/类别执行</Text>
                </Col>
                <Col>
                  <Select
                    placeholder="设备类型"
                    value={runDeviceType}
                    onChange={setRunDeviceType}
                    style={{ width: 140 }}
                    allowClear
                  >
                    {DEVICE_TYPE_OPTIONS.map((opt) => (
                      <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  <Select
                    placeholder="设备类别"
                    value={runDeviceCategory}
                    onChange={setRunDeviceCategory}
                    style={{ width: 140 }}
                    allowClear
                  >
                    {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                      <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunByType}
                    loading={loading}
                    disabled={!runDeviceType && !runDeviceCategory}
                    style={{ background: "#3b82f6", borderColor: "#3b82f6", color: "#fff" }}
                  >
                    执行类型巡检
                  </Button>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 设备列表筛选 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space wrap>
            <Select
              placeholder="按分组筛选列表"
              style={{ width: 160 }}
              allowClear
              onChange={setGroupFilter}
              value={groupFilter}
            >
              {groups.map((group) => (
                <Option key={group.id} value={group.id}>
                  {group.name} ({group.device_count || 0})
                </Option>
              ))}
            </Select>
          </Space>

          <Button icon={<ReloadOutlined />} onClick={fetchDevices}>
            刷新
          </Button>
        </div>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredDevices}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, position: ["bottomCenter"] }}
        bordered
      />
    </div>
  );
}
