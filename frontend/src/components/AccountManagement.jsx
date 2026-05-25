import { useState, useEffect } from "react";
import {
  Table, Button, Modal, Form, Input, Select, message, Space, Tag, Tooltip,
  Popconfirm, Card, Row, Col, Typography, Switch,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { authAPI } from "../services/api";

const { Option } = Select;
const { Text } = Typography;

const ROLE_OPTIONS = [
  { value: "admin", label: "管理员", color: "red" },
  { value: "operator", label: "操作员", color: "blue" },
  { value: "viewer", label: "只读", color: "default" },
];

const PERMISSION_OPTIONS = [
  { value: "device_manage", label: "设备管理" },
  { value: "group_manage", label: "分组管理" },
  { value: "inspection_manage", label: "巡检管理" },
  { value: "backup_manage", label: "备份管理" },
  { value: "ai_manage", label: "AI分析" },
  { value: "system_manage", label: "系统管理" },
];

export default function AccountManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchRole, setSearchRole] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (searchKeyword) params.keyword = searchKeyword;
      if (searchRole) params.role = searchRole;
      const res = await authAPI.getUsers(params);
      setUsers(res?.data || []);
    } catch (error) {
      message.error("获取账号列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchKeyword, searchRole]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // permissions 从数组转为逗号分隔字符串
      const payload = {
        ...values,
        permissions: values.permissions ? values.permissions.join(",") : "",
      };
      if (editingUser) {
        await authAPI.updateUser(editingUser.id, payload);
        message.success("更新成功");
      } else {
        await authAPI.createUser(payload);
        message.success("创建成功");
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || "保存失败");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await authAPI.deleteUser(id);
      if (res.success) {
        message.success("删除成功");
        fetchUsers();
      } else {
        message.error(res.message || "删除失败");
      }
    } catch (error) {
      message.error("删除失败");
    }
  };

  const openEdit = (record) => {
    setEditingUser(record);
    // permissions 从逗号分隔字符串转为数组（Select multiple 需要数组）
    const permArray = record.permissions
      ? record.permissions.split(",").filter(Boolean)
      : [];
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      real_name: record.real_name,
      email: record.email,
      phone: record.phone,
      permissions: permArray,
      is_active: record.is_active,
    });
    setModalVisible(true);
  };

  const openAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: "operator", is_active: true });
    setModalVisible(true);
  };

  // 角色变更时自动设置默认权限
  const handleRoleChange = (role) => {
    const roleDefaultPerms = {
      admin: ["device_manage", "group_manage", "inspection_manage", "backup_manage", "ai_manage", "system_manage"],
      operator: ["device_manage", "group_manage", "inspection_manage", "backup_manage", "ai_manage"],
      viewer: [],
    };
    if (roleDefaultPerms[role]) {
      form.setFieldsValue({ permissions: roleDefaultPerms[role] });
    }
  };

  const getRoleTag = (role) => {
    const opt = ROLE_OPTIONS.find((o) => o.value === role);
    return <Tag color={opt?.color || "default"}>{opt?.label || role}</Tag>;
  };

  const columns = [
    { title: "用户名", dataIndex: "username", key: "username", render: (t) => <Text strong>{t}</Text> },
    { title: "姓名", dataIndex: "real_name", key: "real_name", render: (t) => t || <Text type="secondary">—</Text> },
    { title: "角色", dataIndex: "role", key: "role", render: (r) => getRoleTag(r) },
    {
      title: "权限",
      dataIndex: "permissions",
      key: "permissions",
      render: (p) => {
        if (!p) return <Text type="secondary">—</Text>;
        const perms = p.split(",").filter(Boolean);
        return (
          <Space size={4} wrap>
            {perms.map((perm) => {
              const opt = PERMISSION_OPTIONS.find((o) => o.value === perm);
              return <Tag key={perm} color="blue">{opt?.label || perm}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "is_active",
      key: "is_active",
      render: (v) => <Tag color={v ? "green" : "red"}>{v ? "启用" : "禁用"}</Tag>,
    },
    {
      title: "最后登录",
      dataIndex: "last_login_time",
      key: "last_login_time",
      render: (t) => t ? new Date(t).toLocaleString("zh-CN") : <Text type="secondary">从未登录</Text>,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除该账号？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col>
            <Space wrap>
              <Input
                placeholder="搜索用户名/姓名"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onPressEnter={fetchUsers}
                style={{ width: 200 }}
                allowClear
                onClear={fetchUsers}
              />
              <Select placeholder="按角色筛选" value={searchRole} onChange={setSearchRole} style={{ width: 140 }} allowClear>
                {ROLE_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
              <Button type="primary" onClick={fetchUsers}>查询</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加账号</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, position: ["bottomCenter"] }}
        bordered
      />

      <Modal
        title={editingUser ? "编辑账号" : "添加账号"}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => { setModalVisible(false); setEditingUser(null); form.resetFields(); }}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
                <Input placeholder="登录用户名" disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="角色" name="role" rules={[{ required: true, message: "请选择角色" }]}>
                <Select placeholder="选择角色" onChange={handleRoleChange}>
                  {ROLE_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }, { min: 4, message: "密码至少4位" }]}>
              <Input.Password placeholder="登录密码" />
            </Form.Item>
          )}

          {editingUser && (
            <Form.Item label="新密码" name="password">
              <Input.Password placeholder="留空则不修改密码" />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="姓名" name="real_name">
                <Input placeholder="真实姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="邮箱" name="email">
                <Input placeholder="邮箱地址" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="手机号" name="phone">
            <Input placeholder="手机号码" />
          </Form.Item>

          <Form.Item label="权限" name="permissions">
            <Select mode="multiple" placeholder="选择权限（留空使用角色默认权限）">
              {PERMISSION_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>

          {editingUser && (
            <Form.Item label="账号状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
