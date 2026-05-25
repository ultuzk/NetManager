import { useState, useEffect } from "react";
import {
  Table, Button, Modal, message, Space, Select, Card,
  Row, Col, Statistic, Popconfirm, Tag, Tooltip, Typography,
  Drawer, Tabs, Checkbox, Input, Form, InputNumber, Switch,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, PlayCircleOutlined,
  CloudDownloadOutlined, RedoOutlined, HistoryOutlined,
  EyeOutlined, FileTextOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { backupAPI, deviceAPI, groupAPI, scheduledBackupAPI } from "../services/api";
import { BACKUP_TYPE_OPTIONS, STATUS_MAP, DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS } from "../constants";
import dayjs from "dayjs";

const { Option } = Select;
const { Text, Title } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;

// 目标模式选项
const TARGET_MODE_OPTIONS = [
  { value: "all", label: "所有设备", icon: "🖥️" },
  { value: "devices", label: "指定设备", icon: "📱" },
  { value: "groups", label: "按分组", icon: "📁" },
  { value: "type", label: "按设备类型", icon: "🏷️" },
  { value: "category", label: "按设备类别", icon: "📂" },
];

export default function BackupPanel() {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [backupParams, setBackupParams] = useState({
    targetType: "device",
    targetId: undefined,
    backupType: "running-config",
  });
  const [backupLoading, setBackupLoading] = useState(false);
  const [executingDeviceIds, setExecutingDeviceIds] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [groupFilter, setGroupFilter] = useState(null);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [viewingBackup, setViewingBackup] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [stats, setStats] = useState({
    totalBackups: 0,
    successBackups: 0,
    failedBackups: 0,
    recentBackups: 0,
  });

  // 定时备份相关
  const [schedules, setSchedules] = useState([]);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm] = Form.useForm();
  const [scheduleTargetMode, setScheduleTargetMode] = useState("all");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleExecutingIds, setScheduleExecutingIds] = useState([]);

  const fetchData = async () => {
    try {
      const [devicesRes, groupsRes, backupsRes, schedulesRes] = await Promise.all([
        deviceAPI.getDevices(),
        groupAPI.getGroups(),
        backupAPI.getBackups(),
        scheduledBackupAPI.getAll().catch(() => []),
      ]);

      const devicesList = devicesRes || [];
      const groupsList = groupsRes || [];
      const backupsList = backupsRes || [];
      const schedulesList = Array.isArray(schedulesRes) ? schedulesRes : (schedulesRes?.results || schedulesRes?.data || []);

      setDevices(devicesList);
      setGroups(groupsList);
      setBackups(backupsList);
      setSchedules(schedulesList);

      const now = new Date();
      const recent = backupsList.filter((b) => {
        const d = new Date(b.created_at);
        return (now - d) / (1000 * 60 * 60 * 24) <= 7;
      }).length;
      const success = backupsList.filter(
        (b) => b.status === "success"
      ).length;
      const failed = backupsList.filter(
        (b) => b.status === "failed"
      ).length;

      setStats({
        totalBackups: backupsList.length,
        successBackups: success,
        failedBackups: failed,
        recentBackups: recent,
      });
    } catch (error) {
      message.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const executeBackup = async () => {
    if (!backupParams.targetId) {
      message.warning("请选择目标");
      return;
    }
    try {
      setBackupLoading(true);
      setExecutingDeviceIds([backupParams.targetId]);
      message.info("正在执行备份，请稍候...");
      const result = await backupAPI.executeBackup(
        backupParams.targetId,
        backupParams.backupType
      );
      message.success(result.message || "备份任务已启动");
      fetchData();
    } catch (error) {
      message.error("备份任务启动失败");
    } finally {
      setBackupLoading(false);
      setExecutingDeviceIds([]);
    }
  };

  const executeBatchBackup = async () => {
    if (selectedDevices.length === 0) {
      message.warning("请选择设备");
      return;
    }
    try {
      setBackupLoading(true);
      setExecutingDeviceIds(selectedDevices);
      message.info("正在执行备份，请稍候...");
      const result = await backupAPI.executeBatchBackup(
        selectedDevices,
        backupParams.backupType
      );
      message.success(result.message || `批量备份已提交，共 ${selectedDevices.length} 台设备`);
      setSelectedDevices([]);
      // 延迟刷新，给后台任务一点时间
      setTimeout(fetchData, 2000);
    } catch (error) {
      message.error("批量备份启动失败");
    } finally {
      setBackupLoading(false);
      setExecutingDeviceIds([]);
    }
  };

  const executeGroupBackup = async (groupId) => {
    const groupDevices = devices.filter((d) => d.group_ids?.includes(groupId));
    if (groupDevices.length === 0) {
      message.warning("该分组下没有设备");
      return;
    }
    const deviceIds = groupDevices.map((d) => d.id);
    try {
      setBackupLoading(true);
      setExecutingDeviceIds(deviceIds);
      message.info("正在执行备份，请稍候...");
      const result = await backupAPI.executeBatchBackup(
        deviceIds,
        backupParams.backupType
      );
      message.success(result.message || `分组备份已提交，共 ${deviceIds.length} 台设备`);
      setTimeout(fetchData, 2000);
    } catch (error) {
      message.error("分组备份启动失败");
    } finally {
      setBackupLoading(false);
      setExecutingDeviceIds([]);
    }
  };

  const downloadBackup = async (backupId) => {
    try {
      const backup = backups.find((b) => b.id === backupId);
      const content = backup?.content || "";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `backup_${backupId}_${new Date().toISOString().slice(0, 10)}.txt`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success("下载成功");
    } catch (error) {
      message.error("下载失败");
    }
  };

  const viewBackupContent = (backup) => {
    setViewingBackup(backup);
    setViewDrawerVisible(true);
  };

  const viewBackupHistory = (targetType, targetId) => {
    setSelectedBackup({ targetType, targetId });
    setHistoryVisible(true);
  };

  const getStatusTag = (status) => {
    const s = STATUS_MAP[status] || { color: "default", text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const filteredDevices = groupFilter
    ? devices.filter((d) => d.group_ids?.includes(groupFilter))
    : devices;

  // ==================== 定时备份相关函数 ====================

  const openScheduleModal = (schedule = null) => {
    setEditingSchedule(schedule);
    if (schedule) {
      // 编辑模式：填充表单
      const targetMode = schedule.target_mode || "all";
      setScheduleTargetMode(targetMode);
      scheduleForm.setFieldsValue({
        name: schedule.name,
        backup_type: schedule.backup_type,
        interval_days: schedule.interval_days || 1,
        hour: schedule.hour !== undefined ? schedule.hour : 2,
        minute: schedule.minute !== undefined ? schedule.minute : 0,
        device_ids: schedule.device_ids || [],
        group_ids: schedule.group_ids || [],
        device_type: schedule.device_type || undefined,
        device_category: schedule.device_category || undefined,
        enabled: schedule.enabled !== undefined ? schedule.enabled : true,
      });
    } else {
      // 新建模式：重置表单
      setScheduleTargetMode("all");
      scheduleForm.resetFields();
      scheduleForm.setFieldsValue({
        backup_type: "running-config",
        interval_days: 1,
        hour: 2,
        minute: 0,
        enabled: true,
      });
    }
    setScheduleModalVisible(true);
  };

  const handleScheduleSubmit = async () => {
    try {
      const values = await scheduleForm.validateFields();
      setScheduleLoading(true);

      // 根据目标模式构建参数，不发送 target_mode（后端自动判断）
      const payload = {
        name: values.name,
        backup_type: values.backup_type || "running-config",
        interval_days: values.interval_days || 7,
        hour: values.hour !== undefined ? values.hour : 2,
        minute: values.minute !== undefined ? values.minute : 0,
        enabled: values.enabled !== undefined ? values.enabled : true,
      };

      if (scheduleTargetMode === "all") {
        payload.device_ids = null;
        payload.group_ids = null;
        payload.device_type = null;
        payload.device_category = null;
      } else if (scheduleTargetMode === "devices") {
        payload.device_ids = values.device_ids ? values.device_ids.join(",") : null;
        payload.group_ids = null;
        payload.device_type = null;
        payload.device_category = null;
      } else if (scheduleTargetMode === "groups") {
        payload.device_ids = null;
        payload.group_ids = values.group_ids ? values.group_ids.join(",") : null;
        payload.device_type = null;
        payload.device_category = null;
      } else if (scheduleTargetMode === "type") {
        payload.device_ids = null;
        payload.group_ids = null;
        payload.device_type = values.device_type || null;
        payload.device_category = values.device_category || null;
      } else if (scheduleTargetMode === "category") {
        payload.device_ids = null;
        payload.group_ids = null;
        payload.device_type = null;
        payload.device_category = values.device_category || null;
      }

      if (editingSchedule) {
        await scheduledBackupAPI.update(editingSchedule.id, payload);
        message.success("定时备份已更新");
      } else {
        await scheduledBackupAPI.create(payload);
        message.success("定时备份已创建");
      }

      setScheduleModalVisible(false);
      fetchData();
    } catch (error) {
      if (error.errorFields) {
        // 表单校验失败
        return;
      }
      message.error(editingSchedule ? "更新定时备份失败" : "创建定时备份失败");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await scheduledBackupAPI.delete(id);
      message.success("定时备份已删除");
      fetchData();
    } catch (error) {
      message.error("删除定时备份失败");
    }
  };

  const handleRunScheduleNow = async (id) => {
    try {
      setScheduleExecutingIds((prev) => [...prev, id]);
      message.info("正在执行定时备份，请稍候...");
      const result = await scheduledBackupAPI.runNow(id);
      // 延迟刷新获取执行结果
      setTimeout(async () => {
        await fetchData();
        // 刷新后查找最新结果并展示
        setSchedules((prev) => {
          const updated = prev.find((s) => s.id === id);
          if (updated && updated.last_run_time) {
            showScheduleResult(updated);
          }
          return prev;
        });
      }, 3000);
      message.success("定时备份已触发执行，请稍候查看结果");
    } catch (error) {
      message.error("执行定时备份失败");
    } finally {
      setScheduleExecutingIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const showScheduleResult = (schedule) => {
    if (!schedule.last_run_time) return;
    const resultColor =
      schedule.last_result === "success"
        ? "#52c41a"
        : schedule.last_result === "failed"
        ? "#ff4d4f"
        : schedule.last_result === "partial"
        ? "#faad14"
        : "#666";
    Modal.info({
      title: `定时备份执行结果 — ${schedule.name}`,
      width: 700,
      content: (
        <div style={{ marginTop: 16 }}>
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <Text type="secondary">执行时间</Text>
              <div><Text strong>{dayjs(schedule.last_run_time).format("YYYY-MM-DD HH:mm:ss")}</Text></div>
            </Col>
            <Col span={8}>
              <Text type="secondary">执行结果</Text>
              <div><Tag color={resultColor} style={{ marginTop: 4 }}>{schedule.last_result || "-"}</Tag></div>
            </Col>
            <Col span={8}>
              <Text type="secondary">下次执行</Text>
              <div><Text strong>{schedule.next_run_time ? dayjs(schedule.next_run_time).format("YYYY-MM-DD HH:mm") : "-"}</Text></div>
            </Col>
          </Row>
          {schedule.last_message && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">执行详情</Text>
              <pre
                style={{
                  marginTop: 4,
                  padding: 12,
                  background: "#f5f5f5",
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  maxHeight: 300,
                  overflowY: "auto",
                }}
              >
                {schedule.last_message}
              </pre>
            </div>
          )}
        </div>
      ),
      okText: "关闭",
    });
  };

  const handleToggleSchedule = async (id, enabled) => {
    try {
      await scheduledBackupAPI.update(id, { enabled });
      message.success(enabled ? "定时备份已启用" : "定时备份已禁用");
      fetchData();
    } catch (error) {
      message.error("操作失败");
    }
  };

  const getScheduleTargetLabel = (schedule) => {
    const mode = schedule.target_mode || "all";
    switch (mode) {
      case "all":
        return "所有设备";
      case "devices": {
        const count = schedule.device_ids?.length || 0;
        return `指定设备 (${count}台)`;
      }
      case "groups": {
        const count = schedule.group_ids?.length || 0;
        return `按分组 (${count}个)`;
      }
      case "type": {
        const typeOpt = DEVICE_TYPE_OPTIONS.find((o) => o.value === schedule.device_type);
        return `按类型: ${typeOpt?.label || schedule.device_type}`;
      }
      case "category": {
        const catOpt = DEVICE_CATEGORY_OPTIONS.find((o) => o.value === schedule.device_category);
        return `按类别: ${catOpt?.label || schedule.device_category}`;
      }
      default:
        return mode;
    }
  };

  // ==================== 列定义 ====================

  const deviceColumns = [
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
    { title: "IP地址", dataIndex: "ip_address", key: "ip_address" },
    {
      title: "设备类型",
      dataIndex: "device_type",
      key: "device_type",
      render: (type) => {
        const map = { huawei: "华为", h3c: "H3C", ruijie: "锐捷", cisco: "Cisco" };
        return map[type] || type;
      },
    },
    {
      title: "所属分组",
      dataIndex: "group_name",
      key: "group_name",
      render: (text) => text ? <Tag color="cyan">{text}</Tag> : <Text type="secondary">未分组</Text>,
    },
    {
      title: "最近备份",
      key: "recent_backup",
      render: (_, record) => {
        const deviceBackups = backups.filter(
          (b) => b.device_id === record.id
        );
        if (deviceBackups.length === 0)
          return <Text type="secondary">无备份</Text>;
        const latest = deviceBackups[0];
        return (
          <Space direction="vertical" size="small">
            <Text>{dayjs(latest.created_at).format("YYYY-MM-DD HH:mm")}</Text>
            {getStatusTag(latest.status)}
          </Space>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="执行备份">
            <Button
              size="small"
              onClick={() => {
                setBackupParams({
                  targetType: "device",
                  targetId: record.id,
                  backupType: "running-config",
                });
                executeBackup();
              }}
              icon={<PlayCircleOutlined />}
              loading={
                backupLoading && executingDeviceIds.includes(record.id)
              }
              disabled={backupLoading}
            />
          </Tooltip>
          <Tooltip title="查看备份历史">
            <Button
              size="small"
              onClick={() => viewBackupHistory("device", record.id)}
              icon={<HistoryOutlined />}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: "备份类型",
      dataIndex: "backup_type",
      key: "backup_type",
      render: (type) => {
        const opt = BACKUP_TYPE_OPTIONS.find((o) => o.value === type);
        return opt ? opt.label : type;
      },
    },
    {
      title: "备份时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      render: (text) => text || "-",
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看配置内容">
            <Button
              size="small"
              onClick={() => viewBackupContent(record)}
              icon={<EyeOutlined />}
              disabled={!record.content}
            />
          </Tooltip>
          <Tooltip title="下载备份">
            <Button
              size="small"
              onClick={() => downloadBackup(record.id)}
              icon={<CloudDownloadOutlined />}
              disabled={!record.content}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 全部备份记录（用于备份记录 tab）
  const allBackupColumns = [
    {
      title: "设备名称",
      dataIndex: "device_name",
      key: "device_name",
      render: (text) => text || <Text type="secondary">未知</Text>,
    },
    {
      title: "设备IP",
      dataIndex: "device_ip",
      key: "device_ip",
      render: (text) => text || "-",
    },
    {
      title: "备份类型",
      dataIndex: "backup_type",
      key: "backup_type",
      render: (type) => {
        const opt = BACKUP_TYPE_OPTIONS.find((o) => o.value === type);
        return opt ? opt.label : type;
      },
    },
    {
      title: "备份时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      render: (text) => text || "-",
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看配置内容">
            <Button
              size="small"
              onClick={() => viewBackupContent(record)}
              icon={<EyeOutlined />}
              disabled={!record.content}
            />
          </Tooltip>
          <Tooltip title="下载备份">
            <Button
              size="small"
              onClick={() => downloadBackup(record.id)}
              icon={<CloudDownloadOutlined />}
              disabled={!record.content}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 定时备份列表列
  const scheduleColumns = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "备份类型",
      dataIndex: "backup_type",
      key: "backup_type",
      render: (type) => {
        const opt = BACKUP_TYPE_OPTIONS.find((o) => o.value === type);
        return opt ? opt.label : type;
      },
    },
    {
      title: "目标",
      key: "target",
      render: (_, record) => getScheduleTargetLabel(record),
    },
    {
      title: "间隔",
      dataIndex: "interval_days",
      key: "interval_days",
      render: (val) => `每 ${val || 1} 天`,
    },
    {
      title: "执行时间",
      key: "execute_time",
      render: (_, record) => {
        const h = String(record.hour ?? 0).padStart(2, "0");
        const m = String(record.minute ?? 0).padStart(2, "0");
        return `${h}:${m}`;
      },
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      render: (enabled) =>
        enabled ? (
          <Tag color="success">已启用</Tag>
        ) : (
          <Tag color="default">已禁用</Tag>
        ),
    },
    {
      title: "上次执行",
      dataIndex: "last_run_time",
      key: "last_run_time",
      render: (text) =>
        text ? dayjs(text).format("YYYY-MM-DD HH:mm") : <Text type="secondary">-</Text>,
    },
    {
      title: "上次结果",
      dataIndex: "last_result",
      key: "last_result",
      render: (result) => {
        if (!result) return <Text type="secondary">-</Text>;
        const s = STATUS_MAP[result] || { color: "default", text: result };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: "执行详情",
      dataIndex: "last_message",
      key: "last_message",
      ellipsis: true,
      render: (text) =>
        text ? (
          <Tooltip title={text}>
            <Text style={{ maxWidth: 120 }} ellipsis>{text}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "下次执行",
      dataIndex: "next_run_at",
      key: "next_run_at",
      render: (text) =>
        text ? dayjs(text).format("YYYY-MM-DD HH:mm") : <Text type="secondary">-</Text>,
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="立即执行">
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              loading={scheduleExecutingIds.includes(record.id)}
              disabled={scheduleExecutingIds.includes(record.id)}
              onClick={() => handleRunScheduleNow(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => openScheduleModal(record)}
            />
          </Tooltip>
          <Tooltip title={record.enabled ? "禁用" : "启用"}>
            <Button
              size="small"
              icon={<ClockCircleOutlined />}
              type={record.enabled ? "default" : "primary"}
              onClick={() => handleToggleSchedule(record.id, !record.enabled)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此定时备份？"
            onConfirm={() => handleDeleteSchedule(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredBackups = searchText
    ? backups.filter(
        (b) =>
          (b.device_name || "").toLowerCase().includes(searchText.toLowerCase()) ||
          (b.device_ip || "").toLowerCase().includes(searchText.toLowerCase())
      )
    : backups;

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="总备份数" value={stats.totalBackups} />
          </Col>
          <Col span={6}>
            <Statistic
              title="成功备份"
              value={stats.successBackups}
              valueStyle={{ color: "#3f8600" }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="失败备份"
              value={stats.failedBackups}
              valueStyle={{ color: "#cf1322" }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="近7天备份" value={stats.recentBackups} />
          </Col>
        </Row>
      </Card>

      <Tabs defaultActiveKey="devices" style={{ marginBottom: 24 }}>
        <TabPane tab="设备备份" key="devices">
          {/* 备份操作栏 */}
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Text strong>备份类型：</Text>
                <Select
                  value={backupParams.backupType}
                  onChange={(value) =>
                    setBackupParams((prev) => ({
                      ...prev,
                      backupType: value,
                    }))
                  }
                  style={{ marginLeft: 8, width: 150 }}
                >
                  {BACKUP_TYPE_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={8}>
                <Text strong>分组筛选：</Text>
                <Select
                  placeholder="选择分组"
                  allowClear
                  value={groupFilter}
                  onChange={setGroupFilter}
                  style={{ marginLeft: 8, width: 180 }}
                >
                  {groups.map((group) => (
                    <Option key={group.id} value={group.id}>
                      {group.name} ({group.device_count || 0})
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={10}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={executeBatchBackup}
                    loading={backupLoading}
                    disabled={selectedDevices.length === 0 || backupLoading}
                  >
                    批量备份 ({selectedDevices.length})
                  </Button>
                  {groupFilter && (
                    <Button
                      icon={<PlayCircleOutlined />}
                      onClick={() => executeGroupBackup(groupFilter)}
                      loading={backupLoading}
                      disabled={backupLoading}
                    >
                      备份全部分组设备
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>

          <Table
            columns={deviceColumns}
            dataSource={filteredDevices}
            loading={loading}
            rowKey="id"
            pagination={{ position: ["bottomCenter"], pageSize: 10 }}
            bordered
          />
        </TabPane>

        <TabPane tab="备份记录" key="records">
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Search
              placeholder="搜索设备名称或IP"
              allowClear
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
          </Card>
          <Table
            columns={allBackupColumns}
            dataSource={filteredBackups}
            loading={loading}
            rowKey="id"
            pagination={{ position: ["bottomCenter"], pageSize: 10 }}
            bordered
          />
        </TabPane>

        <TabPane
          tab={
            <span>
              <ClockCircleOutlined />
              定时备份
            </span>
          }
          key="schedules"
        >
          <Card bordered={false} style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openScheduleModal()}
            >
              添加定时备份
            </Button>
          </Card>
          <Table
            columns={scheduleColumns}
            dataSource={schedules}
            loading={loading}
            rowKey="id"
            pagination={{ position: ["bottomCenter"], pageSize: 10 }}
            bordered
            scroll={{ x: 1300 }}
          />
        </TabPane>
      </Tabs>

      {/* 备份历史 Drawer */}
      <Drawer
        title="备份历史记录"
        placement="right"
        onClose={() => setHistoryVisible(false)}
        open={historyVisible}
        width={900}
        destroyOnClose
      >
        {selectedBackup && (
          <div>
            <Title level={4} style={{ marginBottom: 16 }}>
              备份历史
            </Title>
            <Table
              columns={historyColumns}
              dataSource={backups.filter(
                (b) => b.device_id === selectedBackup.targetId
              )}
              rowKey="id"
              pagination={{ position: ["bottomCenter"], pageSize: 10 }}
              bordered
            />
          </div>
        )}
      </Drawer>

      {/* 查看备份内容 Drawer */}
      <Drawer
        title={
          viewingBackup ? (
            <span>
              备份配置 — {viewingBackup.device_name || "未知设备"}
              {viewingBackup.version ? ` (${viewingBackup.version})` : ""}
            </span>
          ) : "备份配置"
        }
        placement="right"
        onClose={() => {
          setViewDrawerVisible(false);
          setViewingBackup(null);
        }}
        open={viewDrawerVisible}
        width={900}
        destroyOnClose
        extra={
          <Space>
            <Button
              icon={<CloudDownloadOutlined />}
              onClick={() => viewingBackup && downloadBackup(viewingBackup.id)}
              disabled={!viewingBackup?.content}
            >
              下载
            </Button>
          </Space>
        }
      >
        {viewingBackup && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Text type="secondary">
                  设备: {viewingBackup.device_name} ({viewingBackup.device_ip})
                </Text>
                <Text type="secondary">
                  类型: {BACKUP_TYPE_OPTIONS.find((o) => o.value === viewingBackup.backup_type)?.label || viewingBackup.backup_type}
                </Text>
                <Text type="secondary">
                  时间: {dayjs(viewingBackup.created_at).format("YYYY-MM-DD HH:mm:ss")}
                </Text>
                {getStatusTag(viewingBackup.status)}
              </Space>
            </div>
            <pre
              style={{
                background: "#f5f5f5",
                padding: 16,
                borderRadius: 8,
                maxHeight: "calc(100vh - 250px)",
                overflow: "auto",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                border: "1px solid #e8e8e8",
              }}
            >
              {viewingBackup.content || "（无配置内容）"}
            </pre>
          </div>
        )}
      </Drawer>

      {/* 添加/编辑定时备份 Modal */}
      <Modal
        title={editingSchedule ? "编辑定时备份" : "添加定时备份"}
        open={scheduleModalVisible}
        onOk={handleScheduleSubmit}
        onCancel={() => setScheduleModalVisible(false)}
        confirmLoading={scheduleLoading}
        width={640}
        destroyOnClose
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          initialValues={{
            backup_type: "running-config",
            interval_days: 1,
            hour: 2,
            minute: 0,
            enabled: true,
          }}
        >
          <Form.Item
            label="任务名称"
            name="name"
            rules={[{ required: true, message: "请输入任务名称" }]}
          >
            <Input placeholder="例如：每日凌晨备份核心交换机" />
          </Form.Item>

          <Form.Item
            label="备份类型"
            name="backup_type"
            rules={[{ required: true, message: "请选择备份类型" }]}
          >
            <Select placeholder="选择备份类型">
              {BACKUP_TYPE_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="间隔天数"
                name="interval_days"
                rules={[{ required: true, message: "请输入间隔天数" }]}
              >
                <InputNumber
                  min={1}
                  max={365}
                  style={{ width: "100%" }}
                  placeholder="每 N 天"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="执行小时"
                name="hour"
                rules={[{ required: true, message: "必填" }]}
              >
                <InputNumber
                  min={0}
                  max={23}
                  style={{ width: "100%" }}
                  placeholder="0-23"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="执行分钟"
                name="minute"
                rules={[{ required: true, message: "必填" }]}
              >
                <InputNumber
                  min={0}
                  max={59}
                  style={{ width: "100%" }}
                  placeholder="0-59"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 目标模式选择 - 卡片点击切换样式 */}
          <Form.Item label="目标模式" required>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {TARGET_MODE_OPTIONS.map((mode) => {
                const isActive = scheduleTargetMode === mode.value;
                return (
                  <div
                    key={mode.value}
                    onClick={() => setScheduleTargetMode(mode.value)}
                    style={{
                      padding: "8px 16px",
                      border: `2px solid ${isActive ? "#1677ff" : "#d9d9d9"}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      background: isActive ? "#e6f4ff" : "#fff",
                      color: isActive ? "#1677ff" : "rgba(0,0,0,0.65)",
                      fontWeight: isActive ? 600 : 400,
                      transition: "all 0.2s",
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{mode.icon}</span>
                    <span>{mode.label}</span>
                  </div>
                );
              })}
            </div>
          </Form.Item>

          {/* 根据目标模式显示不同的选择器 */}
          {scheduleTargetMode === "devices" && (
            <Form.Item
              label="选择设备"
              name="device_ids"
              rules={[{ required: true, message: "请至少选择一个设备" }]}
            >
              <Select
                mode="multiple"
                placeholder="选择设备"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {devices.map((device) => (
                  <Option key={device.id} value={device.id}>
                    {device.name} ({device.ip_address})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {scheduleTargetMode === "groups" && (
            <Form.Item
              label="选择分组"
              name="group_ids"
              rules={[{ required: true, message: "请至少选择一个分组" }]}
            >
              <Select
                mode="multiple"
                placeholder="选择分组"
                allowClear
              >
                {groups.map((group) => (
                  <Option key={group.id} value={group.id}>
                    {group.name} ({group.device_count || 0}台)
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {scheduleTargetMode === "type" && (
            <Form.Item
              label="设备类型"
              name="device_type"
              rules={[{ required: true, message: "请选择设备类型" }]}
            >
              <Select placeholder="选择设备类型" allowClear>
                {DEVICE_TYPE_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {scheduleTargetMode === "category" && (
            <Form.Item
              label="设备类别"
              name="device_category"
              rules={[{ required: true, message: "请选择设备类别" }]}
            >
              <Select placeholder="选择设备类别" allowClear>
                {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            label="启用"
            name="enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
