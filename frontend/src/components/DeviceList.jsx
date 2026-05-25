import { useState, useEffect } from "react";
import {
  Table, Button, Modal, Form, Input, Select, message, Space,
  Popconfirm, Upload, Tag, Tooltip, Card, Row, Col, Statistic,
  Divider, Typography,
} from "antd";
import {
  EditOutlined, DeleteOutlined, PlusOutlined, UploadOutlined,
  DesktopOutlined, ExportOutlined, CloudUploadOutlined, RedoOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { deviceAPI, groupAPI } from "../services/api";
import * as XLSX from "xlsx";
import {
  DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS,
  PROTOCOL_OPTIONS, STATUS_MAP,
} from "../constants";
import CLIConnection from "./CLIConnection";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingDevice, setEditingDevice] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });
  const [cliVisible, setCliVisible] = useState(false);
  const [cliDevice, setCliDevice] = useState(null);
  const [groups, setGroups] = useState([]);

  // 查询条件
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchGroupId, setSearchGroupId] = useState(null);
  const [searchDeviceType, setSearchDeviceType] = useState(null);
  const [searchDeviceCategory, setSearchDeviceCategory] = useState(null);
  const [searchIp, setSearchIp] = useState("");
  const [searchStatus, setSearchStatus] = useState(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const params = { limit: 1000 };
      if (searchKeyword) params.keyword = searchKeyword;
      if (searchGroupId) params.group_id = searchGroupId;
      if (searchDeviceType) params.device_type = searchDeviceType;
      if (searchDeviceCategory) params.device_category = searchDeviceCategory;
      if (searchIp) params.ip_address = searchIp;
      if (searchStatus) params.connection_status = searchStatus;
      const response = await deviceAPI.getDevices(params);
      const list = response || [];
      setDevices(list);
      setStats({
        total: list.length,
        online: list.filter((d) => d.connection_status === "success").length,
        offline: list.filter((d) => d.connection_status === "failed").length,
      });
    } catch (error) {
      message.error("获取设备列表失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await groupAPI.getGroups();
      setGroups(data || []);
    } catch (error) {
      // 静默失败
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchGroups();
  }, []);

  // 查询时触发
  const handleSearch = () => {
    fetchDevices();
  };

  const handleResetSearch = () => {
    setSearchKeyword("");
    setSearchGroupId(null);
    setSearchDeviceType(null);
    setSearchDeviceCategory(null);
    setSearchIp("");
    setSearchStatus(null);
    // 重置后重新查询
    setTimeout(() => fetchDevices(), 0);
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      if (editingDevice) {
        await deviceAPI.updateDevice(editingDevice.id, values);
        message.success("设备更新成功");
      } else {
        await deviceAPI.createDevice(values);
        message.success("设备添加成功");
      }
      setModalVisible(false);
      setEditingDevice(null);
      form.resetFields();
      fetchDevices();
    } catch (error) {
      message.error(editingDevice ? "更新设备失败" : "添加设备失败");
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (deviceId) => {
    // 先记录旧状态用于 stats 计算
    const oldDevice = devices.find((d) => d.id === deviceId);
    const oldStatus = oldDevice?.connection_status;
    try {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, connection_status: "testing" } : d
        )
      );
      const result = await deviceAPI.testConnection(deviceId);
      const data = result?.data || result || {};
      const isSuccess = data.success || result?.success;
      const newStatus = isSuccess ? "success" : "failed";
      // 使用后端返回的最新状态数据（与DB同步）
      const testTime = data.last_test_time || new Date().toISOString();
      const latency = data.last_latency ?? data.latency;
      // 直接用返回结果更新本地设备状态，确保与测试结果关联
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                connection_status: data.connection_status || newStatus,
                last_latency: latency ?? d.last_latency,
                last_test_time: testTime,
              }
            : d
        )
      );
      // 精确更新 stats
      updateStatsAfterTest(oldStatus, newStatus);
      message.success(data.message || result?.message || "连接测试完成");
    } catch (error) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, connection_status: "failed" } : d
        )
      );
      updateStatsAfterTest(oldStatus, "failed");
      message.error("连接测试失败");
    }
  };

  const updateStatsAfterTest = (oldStatus, newStatus) => {
    setStats((prev) => {
      const s = { ...prev };
      // 移除旧状态计数
      if (oldStatus === "success") s.online = Math.max(0, s.online - 1);
      else if (oldStatus === "failed") s.offline = Math.max(0, s.offline - 1);
      // 添加新状态计数
      if (newStatus === "success") s.online++;
      else if (newStatus === "failed") s.offline++;
      return s;
    });
  };

  const deleteDevice = async (deviceId) => {
    try {
      await deviceAPI.deleteDevice(deviceId);
      message.success("设备删除成功");
      fetchDevices();
    } catch (error) {
      message.error("删除设备失败");
    }
  };

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.warning("请选择文件");
      return;
    }
    try {
      setLoading(true);
      const file = fileList[0].originFileObj;
      const data = await file.arrayBuffer();

      // 检测编码并正确解码（处理 UTF-8 无 BOM / GBK 等编码）
      const arr = new Uint8Array(data);
      let text;
      // UTF-8 BOM: EF BB BF
      if (arr.length >= 3 && arr[0] === 0xEF && arr[1] === 0xBB && arr[2] === 0xBF) {
        text = new TextDecoder("utf-8").decode(arr.slice(3));
      } else {
        // 尝试 UTF-8，如果包含替换字符则尝试 GBK
        const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(arr);
        if (utf8Text.includes("�")) {
          try {
            text = new TextDecoder("gbk").decode(arr);
          } catch {
            text = utf8Text;
          }
        } else {
          text = utf8Text;
        }
      }

      // 用 XLSX 解析文本（支持 CSV）
      const workbook = XLSX.read(text, { type: "string" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet);
      if (rows.length === 0) {
        message.warning("文件中没有数据");
        setLoading(false);
        return;
      }
      // 字段映射：支持中文/英文列名
      const fieldMap = {
        设备名称: "name",
        name: "name",
        IP地址: "ip_address",
        ip_address: "ip_address",
        IP: "ip_address",
        用户名: "username",
        username: "username",
        密码: "password",
        password: "password",
        连接协议: "protocol",
        protocol: "protocol",
        端口: "port",
        端口号: "port",
        port: "port",
        设备类型: "device_type",
        device_type: "device_type",
        设备类别: "device_category",
        device_category: "device_category",
        分组: "group_ids",
        分组ID: "group_ids",
        group_ids: "group_ids",
        描述: "description",
        description: "description",
      };
      const devices = [];
      const parseErrors = [];
      rows.forEach((row, index) => {
        const item = {};
        for (const [key, val] of Object.entries(row)) {
          const mapped = fieldMap[key];
          if (mapped) {
            item[mapped] = val;
          }
        }
        // 类型转换
        if (item.port !== undefined && item.port !== "" && item.port !== null) {
          item.port = Number(item.port) || 22;
        } else {
          item.port = 22;
        }
        if (item.protocol !== undefined && item.protocol !== "ssh" && item.protocol !== "telnet") {
          item.protocol = "ssh";
        }
        if (item.group_ids === undefined || item.group_ids === "" || item.group_ids === null) {
          delete item.group_ids;
        } else if (typeof item.group_ids === "number") {
          item.group_ids = [item.group_ids];
        } else if (typeof item.group_ids === "string") {
          item.group_ids = item.group_ids.split(",").map((s) => Number(s.trim())).filter(Boolean);
          if (item.group_ids.length === 0) delete item.group_ids;
        } else {
          delete item.group_ids;
        }
        // 必填字段校验
        if (!item.name) {
          parseErrors.push(`第 ${index + 1} 行: 设备名称为空`);
          return;
        }
        if (!item.ip_address) {
          parseErrors.push(`第 ${index + 1} 行: IP地址为空`);
          return;
        }
        if (!item.username) {
          parseErrors.push(`第 ${index + 1} 行: 用户名为空`);
          return;
        }
        if (!item.password) {
          parseErrors.push(`第 ${index + 1} 行: 密码为空`);
          return;
        }
        devices.push(item);
      });
      if (parseErrors.length > 0) {
        message.error(`数据校验失败:\n${parseErrors.join("\n")}`);
        setLoading(false);
        return;
      }
      if (devices.length === 0) {
        message.warning("没有有效的设备数据可导入");
        setLoading(false);
        return;
      }
      const result = await deviceAPI.importDevices(devices);
      const successCount = result?.data?.success_count ?? 0;
      const failCount = result?.data?.fail_count ?? 0;
      if (failCount > 0) {
        message.warning(`导入完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
      } else {
        message.success(`导入完成: 成功 ${successCount} 条`);
      }
      setImportModalVisible(false);
      setFileList([]);
      fetchDevices();
    } catch (error) {
      console.error("导入失败:", error);
      message.error("批量导入失败: " + (error?.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  };

  const exportDevices = async () => {
    try {
      const response = await deviceAPI.exportDevices();
      const data = response?.data || [];
      if (data.length === 0) {
        message.warning("没有设备可导出");
        return;
      }
      const headers = [
        "name", "ip_address", "username", "password", "protocol",
        "port", "device_type", "device_category", "group_ids", "description",
      ];
      const csv = [
        headers.join(","),
        ...data.map((d) =>
          headers.map((h) => `"${d[h] ?? ""}"`).join(",")
        ),
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "设备列表.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (error) {
      message.error("导出失败");
    }
  };

  const getStatusTag = (status) => {
    const s = STATUS_MAP[status] || { color: "default", text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  // 打开编辑弹窗
  const openEditModal = (record) => {
    setEditingDevice(record);
    // 先设值，再打开弹窗
    form.setFieldsValue({
      name: record.name,
      ip_address: record.ip_address,
      username: record.username,
      protocol: record.protocol,
      port: record.port,
      device_type: record.device_type,
      device_category: record.device_category,
      group_ids: record.group_ids || [],
      description: record.description,
    });
    setModalVisible(true);
  };

  // 打开新增弹窗
  const openAddModal = () => {
    setEditingDevice(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
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
        const opt = DEVICE_TYPE_OPTIONS.find((o) => o.value === type);
        return opt ? opt.label : type;
      },
    },
    {
      title: "设备类别",
      dataIndex: "device_category",
      key: "device_category",
      render: (category) => {
        const opt = DEVICE_CATEGORY_OPTIONS.find((o) => o.value === category);
        return opt ? opt.label : category;
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
      title: "连接协议",
      dataIndex: "protocol",
      key: "protocol",
      render: (protocol) => {
        const opt = PROTOCOL_OPTIONS.find((o) => o.value === protocol);
        return opt ? opt.label : protocol;
      },
    },
    {
      title: "端口",
      dataIndex: "port",
      key: "port",
    },
    {
      title: "状态",
      dataIndex: "connection_status",
      key: "connection_status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "延迟",
      dataIndex: "last_latency",
      key: "last_latency",
      render: (latency) => {
        if (latency == null) return <Text type="secondary">—</Text>;
        const color = latency < 50 ? "#3f8600" : latency < 200 ? "#faad14" : "#cf1322";
        return <Text style={{ color }}>{latency}ms</Text>;
      },
    },
    {
      title: "最近检测",
      dataIndex: "last_test_time",
      key: "last_test_time",
      render: (t) => t ? dayjs(t).format("MM-DD HH:mm") : <Text type="secondary">未检测</Text>,
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="测试连接">
            <Button
              size="small"
              onClick={() => testConnection(record.id)}
              loading={record.connection_status === "testing"}
              icon={<RedoOutlined />}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              size="small"
              onClick={() => openEditModal(record)}
              icon={<EditOutlined />}
            />
          </Tooltip>
          <Tooltip title="CLI连接">
            <Button
              size="small"
              onClick={() => {
                setCliDevice(record);
                setCliVisible(true);
              }}
              icon={<DesktopOutlined />}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该设备？"
            onConfirm={() => deleteDevice(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="设备总数" value={stats.total} />
          </Col>
          <Col span={6}>
            <Statistic
              title="在线设备"
              value={stats.online}
              valueStyle={{ color: "#3f8600" }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="离线设备"
              value={stats.offline}
              valueStyle={{ color: "#cf1322" }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="未知状态"
              value={stats.total - stats.online - stats.offline}
              valueStyle={{ color: "#faad14" }}
            />
          </Col>
        </Row>
      </Card>

      {/* 查询区域 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col>
            <Input
              placeholder="搜索名称/IP/描述"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              allowClear
              onClear={handleSearch}
            />
          </Col>
          <Col>
            <Select
              placeholder="按分组筛选"
              value={searchGroupId}
              onChange={setSearchGroupId}
              style={{ width: 160 }}
              allowClear
            >
              {groups.map((g) => (
                <Option key={g.id} value={g.id}>{g.name}</Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="按设备类型"
              value={searchDeviceType}
              onChange={setSearchDeviceType}
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
              placeholder="按设备类别"
              value={searchDeviceCategory}
              onChange={setSearchDeviceCategory}
              style={{ width: 140 }}
              allowClear
            >
              {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Input
              placeholder="按IP地址"
              value={searchIp}
              onChange={(e) => setSearchIp(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 160 }}
              allowClear
              onClear={handleSearch}
            />
          </Col>
          <Col>
            <Select
              placeholder="按状态筛选"
              value={searchStatus}
              onChange={setSearchStatus}
              style={{ width: 140 }}
              allowClear
            >
              <Option value="success">在线</Option>
              <Option value="failed">离线</Option>
              <Option value="testing">检测中</Option>
              <Option value="unknown">未知</Option>
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleResetSearch}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 操作按钮 */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Button
          type="primary"
          onClick={openAddModal}
          icon={<PlusOutlined />}
        >
          添加设备
        </Button>
        <Space>
          <Button
            onClick={() => setImportModalVisible(true)}
            icon={<CloudUploadOutlined />}
          >
            批量导入
          </Button>
          <Button onClick={exportDevices} icon={<ExportOutlined />}>
            导出列表
          </Button>
          <Button onClick={fetchDevices} icon={<RedoOutlined />}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={devices}
        loading={loading}
        rowKey="id"
        pagination={{ position: ["bottomCenter"], pageSize: 10 }}
        bordered
      />

      {/* 添加/编辑设备模态框 */}
      <Modal
        title={editingDevice ? "编辑设备" : "添加设备"}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalVisible(false);
          setEditingDevice(null);
          form.resetFields();
        }}
        width={700}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="设备名称"
                rules={[{ required: true, message: "请输入设备名称" }]}
              >
                <Input placeholder="例如：核心交换机-1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="ip_address"
                label="IP地址"
                rules={[
                  { required: true, message: "请输入IP地址" },
                  {
                    pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
                    message: "请输入有效的IP地址",
                  },
                ]}
              >
                <Input placeholder="例如：192.168.1.1" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="device_type"
                label="设备类型"
                rules={[{ required: true, message: "请选择设备类型" }]}
              >
                <Select placeholder="选择设备类型">
                  {DEVICE_TYPE_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="device_category"
                label="设备类别"
                rules={[{ required: true, message: "请选择设备类别" }]}
              >
                <Select placeholder="选择设备类别">
                  {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="protocol"
                label="连接协议"
                rules={[{ required: true, message: "请选择连接协议" }]}
              >
                <Select placeholder="选择连接协议">
                  {PROTOCOL_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: "请输入端口号" }]}
              >
                <Input type="number" placeholder="默认：22" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: "请输入用户名" }]}
              >
                <Input placeholder="登录用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  !editingDevice && { required: true, message: "请输入密码" },
                ].filter(Boolean)}
              >
                <Input.Password placeholder={editingDevice ? "留空则不修改密码" : "登录密码"} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="group_ids" label="分组标签（可多选）">
            <Select
              mode="multiple"
              placeholder="选择分组标签（可多选）"
              allowClear
              showSearch
              optionFilterProp="label"
            >
              {groups.map((group) => (
                <Option key={group.id} value={group.id} label={group.name}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="设备描述">
            <Input.TextArea
              rows={2}
              placeholder="可选：设备描述、位置、责任人等信息"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* CLI连接弹窗 */}
      <CLIConnection
        visible={cliVisible}
        onClose={() => {
          setCliVisible(false);
          setCliDevice(null);
        }}
        device={cliDevice}
      />

      {/* 批量导入模态框 */}
      <Modal
        title="批量导入设备"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => setImportModalVisible(false)}
        confirmLoading={loading}
        destroyOnClose
      >
        <Upload
          accept=".xlsx,.xls,.csv"
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList }) => setFileList(fileList)}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Divider />
        <div>
          <Text type="secondary">
            支持的字段：设备名称、IP地址、设备类型、设备类别、连接协议、端口、用户名、密码、描述
          </Text>
        </div>
      </Modal>
    </div>
  );
}
