import { useState, useEffect, useCallback } from "react";
import {
  Table, Button, Modal, Form, Input, message, Space,
  Popconfirm, Select, Tag, Tooltip, Card, Typography,
  Row, Col,
} from "antd";
import {
  EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined,
} from "@ant-design/icons";
import { groupAPI, deviceAPI } from "../services/api";
import { DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS } from "../constants";

// 简易 debounce
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const { Option } = Select;
const { Text } = Typography;

export default function GroupList() {
  const [groups, setGroups] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingGroup, setEditingGroup] = useState(null);

  // 设备搜索相关状态
  const [deviceSearchKeyword, setDeviceSearchKeyword] = useState("");
  const [deviceSearchType, setDeviceSearchType] = useState(null);
  const [deviceSearchCategory, setDeviceSearchCategory] = useState(null);
  const [searchedDevices, setSearchedDevices] = useState([]);
  const [searchingDevices, setSearchingDevices] = useState(false);

  const fetchData = async () => {
    try {
      const [groupsRes, devicesRes] = await Promise.all([
        groupAPI.getGroups(),
        deviceAPI.getDevices({ limit: 1000 }),
      ]);
      setGroups(groupsRes || []);
      setAllDevices(devicesRes || []);
    } catch (error) {
      message.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 通过后端接口搜索设备（用于分组关联）
  const searchDevices = useCallback(
    debounce(async (keyword, deviceType, deviceCategory) => {
      setSearchingDevices(true);
      try {
        const params = { limit: 50 };
        if (keyword) params.keyword = keyword;
        if (deviceType) params.device_type = deviceType;
        if (deviceCategory) params.device_category = deviceCategory;
        const res = await groupAPI.searchDevices(params);
        setSearchedDevices(res?.items || []);
      } catch (error) {
        message.error("搜索设备失败");
      } finally {
        setSearchingDevices(false);
      }
    }, 300),
    []
  );

  // 初始加载时搜索一次
  useEffect(() => {
    if (modalVisible) {
      searchDevices("", null, null);
    }
  }, [modalVisible, searchDevices]);

  const handleDeviceSearch = () => {
    searchDevices(deviceSearchKeyword, deviceSearchType, deviceSearchCategory);
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const payload = {
        name: values.name,
        description: values.description || "",
        device_ids: values.device_ids || [],
      };
      if (editingGroup) {
        await groupAPI.updateGroup(editingGroup.id, payload);
        message.success("分组更新成功");
      } else {
        await groupAPI.createGroup(payload);
        message.success("分组添加成功");
      }
      setModalVisible(false);
      setEditingGroup(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error(editingGroup ? "更新分组失败" : "添加分组失败");
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      await groupAPI.deleteGroup(groupId);
      message.success("分组删除成功");
      fetchData();
    } catch (error) {
      message.error("删除分组失败");
    }
  };

  // 通过多对多关联获取设备
  const getGroupDevices = (groupId) => {
    return allDevices.filter((d) => d.group_ids?.includes(groupId));
  };

  // 获取分组已关联的设备ID列表
  const getGroupDeviceIds = (groupId) => {
    const groupDevices = getGroupDevices(groupId);
    return groupDevices.map((d) => d.id);
  };

  const columns = [
    {
      title: "分组名称",
      dataIndex: "name",
      key: "name",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "设备数量",
      dataIndex: "device_count",
      key: "device_count",
      render: (count) => count || 0,
    },
    {
      title: "设备列表",
      key: "devices",
      render: (_, record) => {
        const groupDevices = getGroupDevices(record.id);
        return groupDevices.length > 0 ? (
          <Space wrap>
            {groupDevices.map((device) => (
              <Tag key={device.id} color="blue">
                {device.name} ({device.ip_address})
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">无设备</Text>
        );
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      render: (text) => text || <Text type="secondary">无描述</Text>,
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              size="small"
              onClick={() => {
                setEditingGroup(record);
                form.setFieldsValue({
                  name: record.name,
                  description: record.description,
                  device_ids: getGroupDeviceIds(record.id),
                });
                setModalVisible(true);
              }}
              icon={<EditOutlined />}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该分组？"
            onConfirm={() => deleteGroup(record.id)}
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
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text type="secondary">共 {groups.length} 个分组</Text>
          </Col>
          <Col>
            <Button
              type="primary"
              onClick={() => {
                setEditingGroup(null);
                form.resetFields();
                setDeviceSearchKeyword("");
                setDeviceSearchType(null);
                setDeviceSearchCategory(null);
                setModalVisible(true);
              }}
              icon={<PlusOutlined />}
            >
              添加分组
            </Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={groups}
        loading={loading}
        rowKey="id"
        pagination={{ position: ["bottomCenter"], pageSize: 10 }}
        bordered
      />

      <Modal
        title={editingGroup ? "编辑分组" : "添加分组"}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setModalVisible(false);
          setEditingGroup(null);
          form.resetFields();
        }}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, message: "请输入分组名称" }]}
          >
            <Input placeholder="例如：核心设备组" />
          </Form.Item>
          <Form.Item name="description" label="分组描述">
            <Input.TextArea rows={2} placeholder="可选：分组描述或用途" />
          </Form.Item>

          {/* 设备查询区域 */}
          <Form.Item label="关联设备（查询多选）">
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              {/* 查询条件 */}
              <Row gutter={8} align="middle">
                <Col flex="auto">
                  <Input
                    placeholder="搜索设备名称或IP"
                    value={deviceSearchKeyword}
                    onChange={(e) => setDeviceSearchKeyword(e.target.value)}
                    onPressEnter={handleDeviceSearch}
                    allowClear
                    onClear={handleDeviceSearch}
                  />
                </Col>
                <Col>
                  <Select
                    placeholder="设备类型"
                    value={deviceSearchType}
                    onChange={setDeviceSearchType}
                    style={{ width: 130 }}
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
                    value={deviceSearchCategory}
                    onChange={setDeviceSearchCategory}
                    style={{ width: 130 }}
                    allowClear
                  >
                    {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                      <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleDeviceSearch}
                    loading={searchingDevices}
                  >
                    查询
                  </Button>
                </Col>
              </Row>

              {/* 多选关联设备 */}
              <Form.Item name="device_ids" style={{ marginBottom: 0 }}>
                <Select
                  mode="multiple"
                  placeholder="查询后选择设备（可多选）"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  optionFilterProp="label"
                  maxTagCount={5}
                  loading={searchingDevices}
                  options={searchedDevices.map((d) => ({
                    key: d.id,
                    value: d.id,
                    label: `${d.name} (${d.ip_address})`,
                  }))}
                  tagRender={({ label, closable, onClose }) => (
                    <Tag
                      color="blue"
                      closable={closable}
                      onClose={onClose}
                      style={{ marginRight: 3 }}
                    >
                      {label}
                    </Tag>
                  )}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已选 {form.getFieldValue("device_ids")?.length || 0} 台设备
                {searchedDevices.length > 0 && ` · 当前查询结果 ${searchedDevices.length} 台`}
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
