import { useState, useEffect } from "react";
import {
  Table, Button, Select, Input, message, Space, Tag, Tabs, Card, Row, Col,
  Typography, Tooltip, Modal,
} from "antd";
import {
  ReloadOutlined, DeleteOutlined, EyeOutlined,
} from "@ant-design/icons";
import { logAPI } from "../services/api";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

const ACTION_MAP = {
  login: { label: "登录", color: "green" },
  logout: { label: "登出", color: "default" },
  create: { label: "创建", color: "blue" },
  update: { label: "更新", color: "orange" },
  delete: { label: "删除", color: "red" },
  execute: { label: "执行", color: "purple" },
  connect: { label: "连接", color: "cyan" },
  disconnect: { label: "断开", color: "default" },
  command: { label: "命令", color: "geekblue" },
};

const TARGET_MAP = {
  device: { label: "设备", color: "blue" },
  group: { label: "分组", color: "cyan" },
  inspection: { label: "巡检", color: "purple" },
  backup: { label: "备份", color: "green" },
  account: { label: "账号", color: "orange" },
  scheduled_backup: { label: "定时备份", color: "gold" },
  system: { label: "系统", color: "red" },
};

export default function LogManagement() {
  const [activeTab, setActiveTab] = useState("operations");
  const [operationLogs, setOperationLogs] = useState([]);
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState({ visible: false, data: null });

  // 操作日志筛选
  const [opKeyword, setOpKeyword] = useState("");
  const [opAction, setOpAction] = useState(null);
  const [opResult, setOpResult] = useState(null);

  // 连接日志筛选
  const [connKeyword, setConnKeyword] = useState("");
  const [connAction, setConnAction] = useState(null);

  const fetchOperationLogs = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (opKeyword) params.keyword = opKeyword;
      if (opAction) params.action = opAction;
      if (opResult) params.result = opResult;
      const res = await logAPI.getOperationLogs(params);
      setOperationLogs(res?.data || []);
    } catch (error) {
      message.error("获取操作日志失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionLogs = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (connKeyword) params.keyword = connKeyword;
      if (connAction) params.action = connAction;
      const res = await logAPI.getConnectionLogs(params);
      setConnectionLogs(res?.data || []);
    } catch (error) {
      message.error("获取连接日志失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "operations") fetchOperationLogs();
    else fetchConnectionLogs();
  }, [activeTab, opKeyword, opAction, opResult, connKeyword, connAction]);

  const handleCleanup = async () => {
    Modal.confirm({
      title: "清理日志",
      content: "确定要清理 90 天前的日志吗？此操作不可恢复。",
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          const res = await logAPI.cleanupLogs(90);
          if (res.success) {
            message.success(res.message);
            if (activeTab === "operations") fetchOperationLogs();
            else fetchConnectionLogs();
          }
        } catch (error) {
          message.error("清理失败");
        }
      },
    });
  };

  const showDetail = (record) => {
    setDetailModal({ visible: true, data: record });
  };

  const operationColumns = [
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (t) => t ? dayjs(t).format("MM-DD HH:mm:ss") : "—",
    },
    {
      title: "用户",
      dataIndex: "username",
      key: "username",
      width: 100,
      render: (t) => <Text strong>{t}</Text>,
    },
    {
      title: "操作",
      dataIndex: "action",
      key: "action",
      width: 80,
      render: (a) => {
        const m = ACTION_MAP[a] || { label: a, color: "default" };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: "对象类型",
      dataIndex: "target_type",
      key: "target_type",
      width: 90,
      render: (t) => {
        if (!t) return "—";
        const m = TARGET_MAP[t] || { label: t, color: "default" };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: "对象名称",
      dataIndex: "target_name",
      key: "target_name",
      width: 120,
      render: (t) => t || "—",
    },
    {
      title: "详情",
      dataIndex: "detail",
      key: "detail",
      ellipsis: true,
      render: (t) => t || <Text type="secondary">—</Text>,
    },
    {
      title: "结果",
      dataIndex: "result",
      key: "result",
      width: 70,
      render: (r) => <Tag color={r === "success" ? "green" : "red"}>{r === "success" ? "成功" : "失败"}</Tag>,
    },
    {
      title: "",
      key: "detail_btn",
      width: 50,
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  const connectionColumns = [
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (t) => t ? dayjs(t).format("MM-DD HH:mm:ss") : "—",
    },
    {
      title: "用户",
      dataIndex: "username",
      key: "username",
      width: 100,
      render: (t) => <Text strong>{t}</Text>,
    },
    {
      title: "设备",
      dataIndex: "device_name",
      key: "device_name",
      width: 120,
      render: (t, r) => t ? `${t} (${r.device_ip})` : "—",
    },
    {
      title: "协议",
      dataIndex: "protocol",
      key: "protocol",
      width: 70,
      render: (p) => p ? <Tag>{p.toUpperCase()}</Tag> : "—",
    },
    {
      title: "动作",
      dataIndex: "action",
      key: "action",
      width: 80,
      render: (a) => {
        const m = ACTION_MAP[a] || { label: a, color: "default" };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: "命令",
      dataIndex: "command",
      key: "command",
      ellipsis: true,
      render: (t) => t ? <Text code style={{ fontSize: 11 }}>{t}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "结果",
      dataIndex: "result",
      key: "result",
      width: 70,
      render: (r) => <Tag color={r === "success" ? "green" : "red"}>{r === "success" ? "成功" : "失败"}</Tag>,
    },
    {
      title: "",
      key: "detail_btn",
      width: 50,
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  const tabItems = [
    {
      key: "operations",
      label: "操作日志",
      children: (
        <div>
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col>
                <Space wrap>
                  <Input placeholder="搜索用户/对象/详情" value={opKeyword} onChange={(e) => setOpKeyword(e.target.value)} onPressEnter={fetchOperationLogs} style={{ width: 200 }} allowClear onClear={fetchOperationLogs} />
                  <Select placeholder="操作类型" value={opAction} onChange={setOpAction} style={{ width: 120 }} allowClear>
                    {Object.entries(ACTION_MAP).map(([k, v]) => (
                      <Option key={k} value={k}>{v.label}</Option>
                    ))}
                  </Select>
                  <Select placeholder="结果" value={opResult} onChange={setOpResult} style={{ width: 100 }} allowClear>
                    <Option value="success">成功</Option>
                    <Option value="failed">失败</Option>
                  </Select>
                  <Button type="primary" onClick={fetchOperationLogs}>查询</Button>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchOperationLogs}>刷新</Button>
                  <Button icon={<DeleteOutlined />} onClick={handleCleanup}>清理旧日志</Button>
                </Space>
              </Col>
            </Row>
          </Card>
          <Table columns={operationColumns} dataSource={operationLogs} loading={loading} rowKey="id" pagination={{ pageSize: 20, position: ["bottomCenter"] }} bordered />
        </div>
      ),
    },
    {
      key: "connections",
      label: "连接日志",
      children: (
        <div>
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col>
                <Space wrap>
                  <Input placeholder="搜索用户/设备/命令" value={connKeyword} onChange={(e) => setConnKeyword(e.target.value)} onPressEnter={fetchConnectionLogs} style={{ width: 200 }} allowClear onClear={fetchConnectionLogs} />
                  <Select placeholder="动作类型" value={connAction} onChange={setConnAction} style={{ width: 120 }} allowClear>
                    <Option value="connect">连接</Option>
                    <Option value="disconnect">断开</Option>
                    <Option value="command">命令</Option>
                  </Select>
                  <Button type="primary" onClick={fetchConnectionLogs}>查询</Button>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchConnectionLogs}>刷新</Button>
                  <Button icon={<DeleteOutlined />} onClick={handleCleanup}>清理旧日志</Button>
                </Space>
              </Col>
            </Row>
          </Card>
          <Table columns={connectionColumns} dataSource={connectionLogs} loading={loading} rowKey="id" pagination={{ pageSize: 20, position: ["bottomCenter"] }} bordered />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

      <Modal
        title="日志详情"
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, data: null })}
        footer={null}
        width={700}
        destroyOnClose
      >
        {detailModal.data && (
          <div style={{ lineHeight: 2 }}>
            {Object.entries(detailModal.data).map(([key, value]) => {
              if (value === null || value === undefined) return null;
              return (
                <div key={key} style={{ display: "flex", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Text strong style={{ minWidth: 100 }}>{key}:</Text>
                  <Text style={{ flex: 1, wordBreak: "break-all" }}>{String(value)}</Text>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
