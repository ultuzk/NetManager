import { useState, useEffect } from "react";
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Tag, Tooltip,
  Popconfirm, Card, Row, Col, Typography, Switch, Drawer, List, Badge, Descriptions,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ReloadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { scheduledBackupAPI, deviceAPI, groupAPI } from "../services/api";
import { DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS, BACKUP_TYPE_OPTIONS } from "../constants";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

export default function ScheduledBackupPanel() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [form] = Form.useForm();
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [targetMode, setTargetMode] = useState("all"); // all | devices | groups | type
  // 执行结果详情抽屉
  const [resultDrawerVisible, setResultDrawerVisible] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await scheduledBackupAPI.getAll();
      setSchedules(res?.data || []);
    } catch (error) {
      message.error("获取定时备份列表失败");
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
    } catch (error) { /* 静默 */ }
  };

  useEffect(() => {
    fetchSchedules();
    fetchDevicesAndGroups();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // 根据目标模式构建参数，不发送 target_mode（后端自动判断）
      const params = {
        name: values.name,
        backup_type: values.backup_type || "running-config",
        interval_days: values.interval_days || 7,
        hour: values.hour !== undefined ? values.hour : 2,
        minute: values.minute !== undefined ? values.minute : 0,
        enabled: values.enabled !== undefined ? values.enabled : true,
      };
      if (targetMode === "all") {
        params.device_ids = null;
        params.group_ids = null;
        params.device_type = null;
        params.device_category = null;
      } else if (targetMode === "devices") {
        params.device_ids = values.device_ids ? values.device_ids.join(",") : null;
        params.group_ids = null;
        params.device_type = null;
        params.device_category = null;
      } else if (targetMode === "groups") {
        params.device_ids = null;
        params.group_ids = values.group_ids ? values.group_ids.join(",") : null;
        params.device_type = null;
        params.device_category = null;
      } else if (targetMode === "type") {
        params.device_ids = null;
        params.group_ids = null;
        params.device_type = values.device_type || null;
        params.device_category = values.device_category || null;
      }

      if (editingSchedule) {
        await scheduledBackupAPI.update(editingSchedule.id, params);
        message.success("更新成功");
      } else {
        await scheduledBackupAPI.create(params);
        message.success("创建成功");
      }
      setModalVisible(false);
      setEditingSchedule(null);
      form.resetFields();
      fetchSchedules();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || "保存失败");
    }
  };

  const handleDelete = async (id) => {
    try {
      await scheduledBackupAPI.delete(id);
      message.success("删除成功");
      fetchSchedules();
    } catch (error) {
      message.error("删除失败");
    }
  };

  const handleRunNow = async (id) => {
    try {
      const res = await scheduledBackupAPI.runNow(id);
      if (res.success) {
        const runResult = res.data?.run_result || {};
        const scheduleData = res.data?.schedule || {};
        // 显示执行结果详情
        setCurrentResult({
          scheduleName: scheduleData.name || "",
          runTime: scheduleData.last_run_time || new Date().toISOString(),
          ...runResult,
        });
        setResultDrawerVisible(true);
        // 刷新列表以更新上次执行时间/结果
        fetchSchedules();
      } else {
        message.error(res.message || "执行失败");
      }
    } catch (error) {
      message.error("执行失败");
    }
  };

  const openEdit = (record) => {
    setEditingSchedule(record);
    // 判断目标模式
    let mode = "all";
    if (record.device_ids) mode = "devices";
    else if (record.group_ids) mode = "groups";
    else if (record.device_type || record.device_category) mode = "type";
    setTargetMode(mode);

    form.setFieldsValue({
      name: record.name,
      backup_type: record.backup_type,
      device_ids: record.device_ids ? record.device_ids.split(",").map(Number) : [],
      group_ids: record.group_ids ? record.group_ids.split(",").map(Number) : [],
      device_type: record.device_type,
      device_category: record.device_category,
      interval_days: record.interval_days,
      hour: record.hour,
      minute: record.minute,
      enabled: record.enabled,
    });
    setModalVisible(true);
  };

  const openAdd = () => {
    setEditingSchedule(null);
    setTargetMode("all");
    form.resetFields();
    form.setFieldsValue({
      backup_type: "running-config",
      interval_days: 7,
      hour: 2,
      minute: 0,
      enabled: true,
    });
    setModalVisible(true);
  };

  const getTargetDesc = (s) => {
    if (s.device_ids) {
      const count = s.device_ids.split(",").length;
      return <Text>指定设备 ({count}台)</Text>;
    }
    if (s.group_ids) {
      const count = s.group_ids.split(",").length;
      return <Text>按分组 ({count}个)</Text>;
    }
    if (s.device_type || s.device_category) {
      const parts = [];
      if (s.device_type) {
        const opt = DEVICE_TYPE_OPTIONS.find((o) => o.value === s.device_type);
        parts.push(opt?.label || s.device_type);
      }
      if (s.device_category) {
        const opt = DEVICE_CATEGORY_OPTIONS.find((o) => o.value === s.device_category);
        parts.push(opt?.label || s.device_category);
      }
      return <Text>按类型/类别 ({parts.join(" + ")})</Text>;
    }
    return <Text>所有设备</Text>;
  };

  const columns = [
    { title: "名称", dataIndex: "name", key: "name", render: (t) => <Text strong>{t}</Text> },
    {
      title: "备份类型",
      dataIndex: "backup_type",
      key: "backup_type",
      render: (t) => {
        const opt = BACKUP_TYPE_OPTIONS.find((o) => o.value === t);
        return <Tag color="blue">{opt?.label || t}</Tag>;
      },
    },
    { title: "目标", key: "target", render: (_, r) => getTargetDesc(r) },
    {
      title: "间隔",
      dataIndex: "interval_days",
      key: "interval_days",
      render: (d) => <Text>每 {d} 天</Text>,
    },
    {
      title: "执行时间",
      key: "time",
      render: (_, r) => <Text>{String(r.hour).padStart(2, "0")}:{String(r.minute).padStart(2, "0")}</Text>,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      render: (v) => <Tag color={v ? "green" : "red"}>{v ? "启用" : "禁用"}</Tag>,
    },
    {
      title: "上次执行",
      dataIndex: "last_run_time",
      key: "last_run_time",
      render: (t) => t ? dayjs(t).format("MM-DD HH:mm") : <Text type="secondary">未执行</Text>,
    },
    {
      title: "上次结果",
      dataIndex: "last_result",
      key: "last_result",
      render: (r) => {
        if (!r) return "—";
        const colorMap = { success: "green", failed: "red", partial: "orange", warning: "gold" };
        const textMap = { success: "成功", failed: "失败", partial: "部分成功", warning: "警告" };
        return <Tag color={colorMap[r] || "default"}>{textMap[r] || r}</Tag>;
      },
    },
    {
      title: "执行摘要",
      dataIndex: "last_message",
      key: "last_message",
      ellipsis: true,
      render: (msg) => msg ? <Tooltip title={msg}><Text type="secondary">{msg}</Text></Tooltip> : "—",
    },
    {
      title: "下次执行",
      dataIndex: "next_run_time",
      key: "next_run_time",
      render: (t) => t ? dayjs(t).format("MM-DD HH:mm") : <Text type="secondary">—</Text>,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="立即执行">
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunNow(record.id)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text type="secondary">共 {schedules.length} 个定时备份任务</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchSchedules}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加定时备份</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={schedules}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, position: ["bottomCenter"] }}
        bordered
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingSchedule ? "编辑定时备份" : "添加定时备份"}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => { setModalVisible(false); setEditingSchedule(null); form.resetFields(); }}
        width={650}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="例如：每日配置备份" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="备份类型" name="backup_type" rules={[{ required: true }]}>
                <Select>
                  {BACKUP_TYPE_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备份间隔" name="interval_days" rules={[{ required: true }]}>
                <InputNumber min={1} max={365} addonAfter="天" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="执行时间（小时）" name="hour" rules={[{ required: true }]}>
                <InputNumber min={0} max={23} addonAfter="时" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="执行时间（分钟）" name="minute" rules={[{ required: true }]}>
                <InputNumber min={0} max={59} addonAfter="分" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="备份目标">
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <div
                onClick={() => setTargetMode("all")}
                style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  background: targetMode === "all" ? "#eef2ff" : "#f8fafc",
                  border: targetMode === "all" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                }}
              >
                <Text strong>所有设备</Text>
              </div>

              <div
                onClick={() => setTargetMode("devices")}
                style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  background: targetMode === "devices" ? "#eef2ff" : "#f8fafc",
                  border: targetMode === "devices" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                }}
              >
                <Text strong>指定设备</Text>
                {targetMode === "devices" && (
                  <div style={{ marginTop: 8 }}>
                    <Form.Item name="device_ids" style={{ marginBottom: 0 }}>
                      <Select mode="multiple" placeholder="选择设备" showSearch optionFilterProp="label" style={{ width: "100%" }}>
                        {devices.map((d) => (
                          <Option key={d.id} value={d.id} label={`${d.name} (${d.ip_address})`}>
                            {d.name} ({d.ip_address})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </div>
                )}
              </div>

              <div
                onClick={() => setTargetMode("groups")}
                style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  background: targetMode === "groups" ? "#eef2ff" : "#f8fafc",
                  border: targetMode === "groups" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                }}
              >
                <Text strong>按分组</Text>
                {targetMode === "groups" && (
                  <div style={{ marginTop: 8 }}>
                    <Form.Item name="group_ids" style={{ marginBottom: 0 }}>
                      <Select mode="multiple" placeholder="选择分组" style={{ width: "100%" }}>
                        {groups.map((g) => (
                          <Option key={g.id} value={g.id}>{g.name} ({g.device_count || 0}台)</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </div>
                )}
              </div>

              <div
                onClick={() => setTargetMode("type")}
                style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  background: targetMode === "type" ? "#eef2ff" : "#f8fafc",
                  border: targetMode === "type" ? "2px solid #6366f1" : "1px solid #e2e8f0",
                }}
              >
                <Text strong>按设备类型/类别</Text>
                {targetMode === "type" && (
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      <Form.Item name="device_type" style={{ marginBottom: 0 }}>
                        <Select placeholder="设备类型" allowClear style={{ width: 150 }}>
                          {DEVICE_TYPE_OPTIONS.map((opt) => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="device_category" style={{ marginBottom: 0 }}>
                        <Select placeholder="设备类别" allowClear style={{ width: 150 }}>
                          {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Space>
                  </div>
                )}
              </div>
            </Space>
          </Form.Item>

          {editingSchedule && (
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 执行结果详情抽屉 */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            <span>执行结果详情 — {currentResult?.scheduleName}</span>
          </Space>
        }
        placement="right"
        width={480}
        open={resultDrawerVisible}
        onClose={() => setResultDrawerVisible(false)}
      >
        {currentResult && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="执行时间">
                {currentResult.runTime ? dayjs(currentResult.runTime).format("YYYY-MM-DD HH:mm:ss") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="总计设备">{currentResult.total || 0} 台</Descriptions.Item>
              <Descriptions.Item label="成功">
                <Text style={{ color: "#3f8600" }}>{currentResult.success_count || 0} 台</Text>
              </Descriptions.Item>
              <Descriptions.Item label="失败">
                <Text style={{ color: "#cf1322" }}>{currentResult.fail_count || 0} 台</Text>
              </Descriptions.Item>
              <Descriptions.Item label="摘要">{currentResult.message || "—"}</Descriptions.Item>
            </Descriptions>

            <Text strong style={{ fontSize: 14 }}>设备执行明细</Text>
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={currentResult.devices || []}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ width: "100%" }}>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Text strong>{item.device_name || `设备 #${item.device_id}`}</Text>
                      </Col>
                      <Col>
                        <Badge
                          status={item.status === "success" ? "success" : "error"}
                          text={item.status === "success" ? "成功" : "失败"}
                        />
                      </Col>
                    </Row>
                    {item.message && (
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
                    )}
                  </div>
                </List.Item>
              )}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
