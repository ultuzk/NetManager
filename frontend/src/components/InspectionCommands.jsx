import { useState, useEffect } from "react";
import {
  Table, Button, Modal, Form, Input, Select, message, Tag, Space, Card, Typography,
  notification,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
} from "@ant-design/icons";
import { inspectionAPI, deviceAPI, groupAPI } from "../services/api";
import { INSPECTION_DEVICE_TYPE_OPTIONS, DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS } from "../constants";

const { Option } = Select;
const { Text } = Typography;

export default function InspectionCommands({ onRefresh }) {
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [form] = Form.useForm();

  // 单命令运行弹窗
  const [runModalVisible, setRunModalVisible] = useState(false);
  const [runningCommand, setRunningCommand] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runDeviceIds, setRunDeviceIds] = useState([]);
  const [runGroupIds, setRunGroupIds] = useState([]);
  const [runDeviceType, setRunDeviceType] = useState(null);
  const [runDeviceCategory, setRunDeviceCategory] = useState(null);
  const [runMode, setRunMode] = useState("all"); // all | devices | groups | type
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);

  const fetchCommands = async () => {
    setLoading(true);
    try {
      const data = await inspectionAPI.getCommands();
      setCommands(data || []);
    } catch (error) {
      message.error("获取巡检命令失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchDevicesAndGroups = async () => {
    try {
      const [devRes, grpRes] = await Promise.all([
        deviceAPI.getDevices({ limit: 1000 }),
        groupAPI.getGroups(),
      ]);
      setDevices(devRes || []);
      setGroups(grpRes || []);
    } catch (error) {
      // 静默
    }
  };

  useEffect(() => {
    fetchCommands();
    fetchDevicesAndGroups();
  }, []);

  const handleSaveCommand = async () => {
    try {
      const values = await form.validateFields();
      if (editingCommand) {
        await inspectionAPI.updateCommand(editingCommand.id, values);
        message.success("更新成功");
      } else {
        await inspectionAPI.createCommand(values);
        message.success("创建成功");
      }
      setModalVisible(false);
      setEditingCommand(null);
      form.resetFields();
      fetchCommands();
      onRefresh?.();
    } catch (error) {
      if (error.errorFields) return;
      message.error("保存失败");
    }
  };

  const handleDeleteCommand = async (id) => {
    try {
      await inspectionAPI.deleteCommand(id);
      message.success("删除成功");
      fetchCommands();
      onRefresh?.();
    } catch (error) {
      message.error("删除失败");
    }
  };

  // 打开运行弹窗
  const handleOpenRun = (record) => {
    setRunningCommand(record);
    setRunMode("all");
    setRunDeviceIds([]);
    setRunGroupIds([]);
    setRunDeviceType(null);
    setRunDeviceCategory(null);
    setRunModalVisible(true);
  };

  // 执行单命令运行
  const handleRunCommand = async () => {
    if (!runningCommand) return;

    const params = {};
    let targetDesc = "";

    switch (runMode) {
      case "devices":
        if (runDeviceIds.length === 0) {
          message.warning("请选择至少一个设备");
          return;
        }
        params.device_ids = runDeviceIds;
        targetDesc = `${runDeviceIds.length} 台设备`;
        break;
      case "groups":
        if (runGroupIds.length === 0) {
          message.warning("请选择至少一个分组");
          return;
        }
        params.group_ids = runGroupIds;
        targetDesc = `${runGroupIds.length} 个分组`;
        break;
      case "type":
        if (!runDeviceType && !runDeviceCategory) {
          message.warning("请选择设备类型或设备类别");
          return;
        }
        if (runDeviceType) params.device_type = runDeviceType;
        if (runDeviceCategory) params.device_category = runDeviceCategory;
        targetDesc = `${runDeviceType ? DEVICE_TYPE_OPTIONS.find(o => o.value === runDeviceType)?.label + ' 类型' : ''}${runDeviceType && runDeviceCategory ? ' + ' : ''}${runDeviceCategory ? DEVICE_CATEGORY_OPTIONS.find(o => o.value === runDeviceCategory)?.label + ' 类别' : ''}`;
        break;
      case "all":
      default:
        targetDesc = "所有匹配设备";
        break;
    }

    setRunLoading(true);
    try {
      notification.info({
        message: '命令执行中',
        description: `正在执行 [${runningCommand.name}]，目标: ${targetDesc}...`,
        duration: 4,
      });
      const result = await inspectionAPI.executeSingleCommand(runningCommand.id, params);
      if (result.success) {
        message.success(`命令 [${runningCommand.name}] 已提交，目标: ${targetDesc}，共 ${result.data?.total || 0} 台设备`);
        setRunModalVisible(false);
        onRefresh?.();
      } else {
        message.error(result.message || "执行失败");
      }
    } catch (error) {
      message.error("执行失败: " + (error.message || "未知错误"));
    } finally {
      setRunLoading(false);
    }
  };

  const commandColumns = [
    {
      title: "命令名称",
      dataIndex: "name",
      key: "name",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "命令内容",
      dataIndex: "command",
      key: "command",
      render: (text) => (
        <div style={{ maxWidth: 300 }}>
          <Text
            code
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {text}
          </Text>
        </div>
      ),
    },
    {
      title: "适用设备",
      dataIndex: "device_type",
      key: "device_type",
      render: (text) => {
        const opt = INSPECTION_DEVICE_TYPE_OPTIONS.find((o) => o.value === text);
        const colorMap = { huawei: "blue", h3c: "green", ruijie: "orange", cisco: "purple", all: "cyan" };
        return <Tag color={colorMap[text] || "default"}>{opt ? opt.label : text}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      render: (v) => <Tag color={v ? "green" : "red"}>{v ? "启用" : "禁用"}</Tag>,
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={() => handleOpenRun(record)}
            disabled={!record.enabled}
          >
            运行
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingCommand(record);
              form.setFieldsValue(record);
              setModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            danger
            size="small"
            onClick={() => handleDeleteCommand(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Text type="secondary">共 {commands.length} 条巡检命令</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCommand(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            添加命令
          </Button>
        </div>
      </Card>

      <Table
        columns={commandColumns}
        dataSource={commands}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, position: ["bottomCenter"] }}
        bordered
      />

      {/* 添加/编辑命令弹窗 */}
      <Modal
        title={editingCommand ? "编辑巡检命令" : "添加巡检命令"}
        open={modalVisible}
        onOk={handleSaveCommand}
        onCancel={() => {
          setModalVisible(false);
          setEditingCommand(null);
          form.resetFields();
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="命令名称"
            name="name"
            rules={[{ required: true, message: "请输入命令名称" }]}
          >
            <Input placeholder="例如：设备版本" />
          </Form.Item>
          <Form.Item
            label="命令内容"
            name="command"
            rules={[{ required: true, message: "请输入命令内容" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="例如：display version&#10;display interface brief&#10;display cpu-usage"
              style={{ fontFamily: "Consolas, 'Courier New', monospace" }}
            />
          </Form.Item>
          <Form.Item
            label="适用设备类型"
            name="device_type"
            rules={[{ required: true, message: "请选择设备类型" }]}
          >
            <Select placeholder="请选择适用的设备类型">
              {INSPECTION_DEVICE_TYPE_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 单命令运行弹窗 */}
      <Modal
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlayCircleOutlined style={{ color: "#6366f1" }} />
            <span>运行命令 — {runningCommand?.name}</span>
            <Text code style={{ fontSize: 12, marginLeft: 8, whiteSpace: "pre-wrap", wordBreak: "break-all", display: "inline-block", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis" }}>{runningCommand?.command}</Text>
          </span>
        }
        open={runModalVisible}
        onOk={handleRunCommand}
        onCancel={() => setRunModalVisible(false)}
        confirmLoading={runLoading}
        width={600}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            选择执行目标，命令将发送到匹配的设备上执行
          </Text>
        </div>

        {/* 运行模式选择 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>执行目标</Text>
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            {/* 所有匹配设备 */}
            <div
              onClick={() => setRunMode("all")}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                cursor: "pointer",
                background: runMode === "all" ? "#eef2ff" : "#f8fafc",
                border: runMode === "all" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                transition: "all 0.2s",
              }}
            >
              <Text strong>所有匹配设备</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                自动匹配适用设备类型（{INSPECTION_DEVICE_TYPE_OPTIONS.find(o => o.value === runningCommand?.device_type)?.label || "全部"}）的所有设备
              </Text>
            </div>

            {/* 选中设备 */}
            <div
              onClick={() => setRunMode("devices")}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                cursor: "pointer",
                background: runMode === "devices" ? "#eef2ff" : "#f8fafc",
                border: runMode === "devices" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                transition: "all 0.2s",
              }}
            >
              <Text strong>选中设备</Text>
              {runMode === "devices" && (
                <div style={{ marginTop: 8 }}>
                  <Select
                    mode="multiple"
                    placeholder="选择设备（可多选）"
                    value={runDeviceIds}
                    onChange={setRunDeviceIds}
                    style={{ width: "100%" }}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount={5}
                  >
                    {devices.map((d) => (
                      <Option key={d.id} value={d.id} label={`${d.name} (${d.ip_address})`}>
                        {d.name} ({d.ip_address})
                      </Option>
                    ))}
                  </Select>
                  {runDeviceIds.length > 0 && (
                    <Text style={{ fontSize: 12, color: "#6366f1" }}>已选 {runDeviceIds.length} 台设备</Text>
                  )}
                </div>
              )}
            </div>

            {/* 按分组 */}
            <div
              onClick={() => setRunMode("groups")}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                cursor: "pointer",
                background: runMode === "groups" ? "#eef2ff" : "#f8fafc",
                border: runMode === "groups" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                transition: "all 0.2s",
              }}
            >
              <Text strong>按分组</Text>
              {runMode === "groups" && (
                <div style={{ marginTop: 8 }}>
                  <Select
                    mode="multiple"
                    placeholder="选择分组（可多选）"
                    value={runGroupIds}
                    onChange={setRunGroupIds}
                    style={{ width: "100%" }}
                    maxTagCount={5}
                  >
                    {groups.map((g) => (
                      <Option key={g.id} value={g.id}>
                        {g.name} ({g.device_count || 0}台)
                      </Option>
                    ))}
                  </Select>
                  {runGroupIds.length > 0 && (
                    <Text style={{ fontSize: 12, color: "#6366f1" }}>已选 {runGroupIds.length} 个分组</Text>
                  )}
                </div>
              )}
            </div>

            {/* 按设备类型/类别 */}
            <div
              onClick={() => setRunMode("type")}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                cursor: "pointer",
                background: runMode === "type" ? "#eef2ff" : "#f8fafc",
                border: runMode === "type" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                transition: "all 0.2s",
              }}
            >
              <Text strong>按设备类型/类别</Text>
              {runMode === "type" && (
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    <Select
                      placeholder="设备类型"
                      value={runDeviceType}
                      onChange={setRunDeviceType}
                      style={{ width: 160 }}
                      allowClear
                    >
                      {DEVICE_TYPE_OPTIONS.map((opt) => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                    <Select
                      placeholder="设备类别"
                      value={runDeviceCategory}
                      onChange={setRunDeviceCategory}
                      style={{ width: 160 }}
                      allowClear
                    >
                      {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </Space>
                </div>
              )}
            </div>
          </Space>
        </div>
      </Modal>
    </div>
  );
}
