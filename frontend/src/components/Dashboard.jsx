import { useState, useEffect } from "react";
import {
  Card, Row, Col, Statistic, Table, Tag, Typography, Spin, message,
  Progress, Empty, Avatar,
} from "antd";
import {
  HddOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileSearchOutlined, SaveOutlined,
  CloudServerOutlined, ApiOutlined, ClockCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from "@ant-design/icons";
import { deviceAPI, groupAPI, inspectionAPI, backupAPI } from "../services/api";
import { DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS } from "../constants";
import dayjs from "dayjs";

const { Text, Title } = Typography;

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDevices: 0, onlineDevices: 0, offlineDevices: 0, testingDevices: 0,
    deviceTypeMap: {}, deviceCategoryMap: {},
    totalGroups: 0,
    totalInspections: 0, successInspections: 0, failedInspections: 0,
    recentInspectionTime: null,
    totalBackups: 0, successBackups: 0, failedBackups: 0,
    recentBackupTime: null,
    recentInspections: [],
    recentBackups: [],
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [devicesRes, groupsRes, inspectionsRes, backupsRes] = await Promise.all([
        deviceAPI.getDevices({ limit: 1000 }),
        groupAPI.getGroups(),
        inspectionAPI.getRecords({ limit: 100 }),
        backupAPI.getBackups(),
      ]);

      const devices = devicesRes || [];
      const groups = groupsRes || [];
      const inspections = inspectionsRes || [];
      const backups = backupsRes || [];

      const deviceTypeMap = {};
      const deviceCategoryMap = {};
      let online = 0, offline = 0, testing = 0;
      devices.forEach((d) => {
        if (d.connection_status === "success") online++;
        else if (d.connection_status === "failed") offline++;
        else if (d.connection_status === "testing") testing++;
        const typeLabel = DEVICE_TYPE_OPTIONS.find((o) => o.value === d.device_type)?.label || d.device_type || "未知";
        deviceTypeMap[typeLabel] = (deviceTypeMap[typeLabel] || 0) + 1;
        const catLabel = DEVICE_CATEGORY_OPTIONS.find((o) => o.value === d.device_category)?.label || d.device_category || "未知";
        deviceCategoryMap[catLabel] = (deviceCategoryMap[catLabel] || 0) + 1;
      });

      let inspSuccess = 0, inspFailed = 0;
      inspections.forEach((r) => {
        if (r.status === "success") inspSuccess++;
        else if (r.status === "failed") inspFailed++;
      });

      let backupSuccess = 0, backupFailed = 0;
      backups.forEach((b) => {
        if (b.status === "success") backupSuccess++;
        else if (b.status === "failed") backupFailed++;
      });

      const recentInspTime = inspections.length > 0
        ? inspections.reduce((max, r) => r.created_at > max ? r.created_at : max, inspections[0]?.created_at)
        : null;
      const recentBackupTime = backups.length > 0
        ? backups.reduce((max, b) => b.created_at > max ? b.created_at : max, backups[0]?.created_at)
        : null;

      setStats({
        totalDevices: devices.length, onlineDevices: online, offlineDevices: offline, testingDevices: testing,
        deviceTypeMap, deviceCategoryMap,
        totalGroups: groups.length,
        totalInspections: inspections.length, successInspections: inspSuccess, failedInspections: inspFailed,
        recentInspectionTime: recentInspTime,
        totalBackups: backups.length, successBackups: backupSuccess, failedBackups: backupFailed,
        recentBackupTime: recentBackupTime,
        recentInspections: inspections.slice(0, 5),
        recentBackups: backups.slice(0, 5),
      });
    } catch (error) {
      message.error("获取统计数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onlineRate = stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0;

  const statCards = [
    {
      title: "设备总数",
      value: stats.totalDevices,
      suffix: <Text style={{ fontSize: 14, color: '#94a3b8' }}>/ {stats.totalGroups} 分组</Text>,
      icon: <HddOutlined />,
      gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      progress: onlineRate,
      progressLabel: `${onlineRate}% 在线`,
      extra: (
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <Text style={{ color: '#10b981', fontSize: 12 }}>
            <CheckCircleOutlined /> 在线 {stats.onlineDevices}
          </Text>
          <Text style={{ color: '#ef4444', fontSize: 12 }}>
            <CloseCircleOutlined /> 离线 {stats.offlineDevices}
          </Text>
        </div>
      ),
    },
    {
      title: "巡检记录",
      value: stats.totalInspections,
      icon: <FileSearchOutlined />,
      gradient: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)",
      extra: (
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <Text style={{ color: '#10b981', fontSize: 12 }}>
            <ArrowUpOutlined /> 成功 {stats.successInspections}
          </Text>
          <Text style={{ color: '#ef4444', fontSize: 12 }}>
            <ArrowDownOutlined /> 失败 {stats.failedInspections}
          </Text>
        </div>
      ),
    },
    {
      title: "备份记录",
      value: stats.totalBackups,
      icon: <SaveOutlined />,
      gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
      extra: (
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <Text style={{ color: '#10b981', fontSize: 12 }}>
            <ArrowUpOutlined /> 成功 {stats.successBackups}
          </Text>
          <Text style={{ color: '#ef4444', fontSize: 12 }}>
            <ArrowDownOutlined /> 失败 {stats.failedBackups}
          </Text>
        </div>
      ),
    },
    {
      title: "设备类型",
      value: Object.keys(stats.deviceTypeMap).length,
      suffix: <Text style={{ fontSize: 14, color: '#94a3b8' }}>种类型</Text>,
      icon: <CloudServerOutlined />,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
      extra: (
        <div style={{ marginTop: 4 }}>
          {Object.entries(stats.deviceTypeMap).slice(0, 3).map(([type, count]) => (
            <Tag key={type} style={{ marginRight: 4, marginBottom: 2 }}>{type} {count}</Tag>
          ))}
        </div>
      ),
    },
  ];

  const deviceTypeColumns = [
    { title: "设备类型", dataIndex: "type", key: "type", render: (t) => <Tag color="indigo">{t}</Tag> },
    { title: "数量", dataIndex: "count", key: "count", align: "right" },
    {
      title: "占比", dataIndex: "percent", key: "percent",
      render: (_, r) => (
        <Progress
          percent={Math.round((r.count / stats.totalDevices) * 100)}
          size="small"
          style={{ width: 100 }}
          strokeColor="#6366f1"
          trailColor="#f1f5f9"
        />
      ),
    },
  ];
  const deviceTypeData = Object.entries(stats.deviceTypeMap).map(([type, count]) => ({ key: type, type, count }));

  const recentInspColumns = [
    { title: "设备", dataIndex: "device_name", key: "device_name", render: (t) => t || <Text type="secondary">未知</Text> },
    { title: "命令", dataIndex: "command_name", key: "command_name", ellipsis: true },
    {
      title: "状态", dataIndex: "status", key: "status",
      render: (s) => <Tag color={s === "success" ? "success" : "error"}>{s === "success" ? "成功" : "失败"}</Tag>,
    },
    { title: "时间", dataIndex: "created_at", key: "created_at", render: (t) => t ? dayjs(t).format("MM-DD HH:mm") : "-" },
  ];

  const recentBackupColumns = [
    { title: "设备", dataIndex: "device_name", key: "device_name", render: (t) => t || <Text type="secondary">未知</Text> },
    {
      title: "类型", dataIndex: "backup_type", key: "backup_type",
      render: (t) => t === "running-config" ? "运行配置" : t === "startup-config" ? "启动配置" : t,
    },
    {
      title: "状态", dataIndex: "status", key: "status",
      render: (s) => <Tag color={s === "success" ? "success" : s === "failed" ? "error" : "default"}>{s === "success" ? "成功" : s === "failed" ? "失败" : s}</Tag>,
    },
    { title: "时间", dataIndex: "created_at", key: "created_at", render: (t) => t ? dayjs(t).format("MM-DD HH:mm") : "-" },
  ];

  return (
    <Spin spinning={loading}>
      {/* 统计卡片 */}
      <Row gutter={[20, 20]}>
        {statCards.map((card, i) => (
          <Col span={6} key={i}>
            <Card
              bordered={false}
              hoverable
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                position: 'relative',
              }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 80,
                  height: 80,
                  background: card.gradient,
                  borderRadius: '0 16px 0 80px',
                  opacity: 0.15,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>{card.title}</Text>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.5px' }}>
                      {card.value}
                    </span>
                    {card.suffix}
                  </div>
                  {card.progress !== undefined && (
                    <Progress
                      percent={card.progress}
                      size="small"
                      strokeColor="#10b981"
                      trailColor="#f1f5f9"
                      style={{ marginTop: 8, maxWidth: 200 }}
                      format={() => card.progressLabel}
                    />
                  )}
                  {card.extra}
                </div>
                <Avatar
                  size={48}
                  style={{ background: card.gradient, flexShrink: 0 }}
                  icon={card.icon}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 中部 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col span={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudServerOutlined style={{ color: '#6366f1' }} />
                <span>设备类型分布</span>
              </span>
            }
            bordered={false}
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            {deviceTypeData.length > 0 ? (
              <Table columns={deviceTypeColumns} dataSource={deviceTypeData} pagination={false} size="small" />
            ) : (
              <Empty description="暂无设备" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ApiOutlined style={{ color: '#6366f1' }} />
                <span>设备类别分布</span>
              </span>
            }
            bordered={false}
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            {Object.keys(stats.deviceCategoryMap).length > 0 ? (
              <Row gutter={[12, 12]}>
                {Object.entries(stats.deviceCategoryMap).map(([cat, count]) => (
                  <Col span={12} key={cat}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                      }}
                    >
                      <Text style={{ color: '#64748b', fontSize: 13 }}>{cat}</Text>
                      <div>
                        <span style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{count}</span>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description="暂无设备" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部：最近记录 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col span={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSearchOutlined style={{ color: '#6366f1' }} />
                <span>最近巡检记录</span>
                {stats.recentInspectionTime && (
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8, fontWeight: 'normal' }}>
                    最后执行: {dayjs(stats.recentInspectionTime).format("MM-DD HH:mm")}
                  </Text>
                )}
              </span>
            }
            bordered={false}
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            {stats.recentInspections.length > 0 ? (
              <Table columns={recentInspColumns} dataSource={stats.recentInspections} pagination={false} size="small" />
            ) : (
              <Empty description="暂无巡检记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SaveOutlined style={{ color: '#6366f1' }} />
                <span>最近备份记录</span>
                {stats.recentBackupTime && (
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8, fontWeight: 'normal' }}>
                    最后备份: {dayjs(stats.recentBackupTime).format("MM-DD HH:mm")}
                  </Text>
                )}
              </span>
            }
            bordered={false}
            style={{ borderRadius: 16 }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            {stats.recentBackups.length > 0 ? (
              <Table columns={recentBackupColumns} dataSource={stats.recentBackups} pagination={false} size="small" />
            ) : (
              <Empty description="暂无备份记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
