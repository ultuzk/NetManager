import { useState, useEffect } from "react";
import {
  Table, Button, Select, message, Space, Tag, Typography, Card, Modal, Input, DatePicker,
} from "antd";
import {
  EyeOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined,
} from "@ant-design/icons";
import { inspectionAPI, deviceAPI } from "../services/api";
import { DEVICE_TYPE_OPTIONS, DEVICE_CATEGORY_OPTIONS } from "../constants";
import dayjs from "dayjs";

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function InspectionRecords() {
  const [records, setRecords] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(null);
  const [deviceCategoryFilter, setDeviceCategoryFilter] = useState(null);
  const [timeRange, setTimeRange] = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (deviceFilter) params.device_id = deviceFilter;
      if (deviceTypeFilter) params.device_type = deviceTypeFilter;
      if (deviceCategoryFilter) params.device_category = deviceCategoryFilter;
      if (timeRange && timeRange.length === 2) {
        params.start_time = timeRange[0];
        params.end_time = timeRange[1];
      }
      const data = await inspectionAPI.getRecords(params);
      let list = data || [];
      // 前端过滤（状态、搜索）
      if (statusFilter) {
        list = list.filter((r) => r.status === statusFilter);
      }
      if (searchText) {
        const lower = searchText.toLowerCase();
        list = list.filter(
          (r) =>
            (r.device_name || "").toLowerCase().includes(lower) ||
            (r.command_name || "").toLowerCase().includes(lower)
        );
      }
      setRecords(list);
    } catch (error) {
      message.error("获取巡检记录失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const data = await deviceAPI.getDevices({ limit: 1000 });
      setDevices(data || []);
    } catch (error) {
      // 静默
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchDevices();
  }, [deviceFilter, statusFilter, deviceTypeFilter, deviceCategoryFilter, timeRange]);

  const handleExport = () => {
    if (records.length === 0) {
      message.warning("没有记录可导出");
      return;
    }
    const headers = ["设备名称", "IP地址", "命令名称", "状态", "执行时间", "输出摘要"];
    const data = records.map((record) => [
      record.device_name || "未知",
      record.device_ip || "-",
      record.command_name || "-",
      record.status === "success" ? "成功" : "失败",
      record.created_at ? dayjs(record.created_at).format("YYYY-MM-DD HH:mm:ss") : "-",
      (record.command_output || "").substring(0, 200).replace(/\n/g, " "),
    ]);
    const csv = [
      headers.join(","),
      ...data.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inspection_records_${dayjs().format("YYYYMMDDHHmmss")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success("导出成功");
  };

  const columns = [
    {
      title: "设备名称",
      dataIndex: "device_name",
      key: "device_name",
      render: (text) => text || <Text type="secondary">未知</Text>,
    },
    {
      title: "IP地址",
      dataIndex: "device_ip",
      key: "device_ip",
      render: (text) => text || "-",
    },
    {
      title: "命令名称",
      dataIndex: "command_name",
      key: "command_name",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (text) => (
        <Tag color={text === "success" ? "green" : "red"}>
          {text === "success" ? "成功" : "失败"}
        </Tag>
      ),
    },
    {
      title: "输出大小",
      dataIndex: "command_output",
      key: "output_size",
      render: (text) => {
        if (!text) return <Text type="secondary">0</Text>;
        const len = text.length;
        if (len > 10000) return <Text strong>{len.toLocaleString()} 字符</Text>;
        return <Text>{len.toLocaleString()} 字符</Text>;
      },
    },
    {
      title: "执行时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text) => (text ? dayjs(text).format("MM-DD HH:mm:ss") : "-"),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: "descend",
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => {
            Modal.info({
              title: (
                <span>
                  巡检结果 — {record.device_name || "未知设备"} / {record.command_name}
                </span>
              ),
              content: (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">
                      {record.device_ip} | {record.status === "success" ? "成功" : "失败"} |{" "}
                      {record.created_at ? dayjs(record.created_at).format("YYYY-MM-DD HH:mm:ss") : "-"}
                    </Text>
                  </div>
                  <pre
                    style={{
                      maxHeight: "400px",
                      overflowY: "auto",
                      background: "#f5f5f5",
                      padding: 12,
                      borderRadius: 4,
                      fontSize: 12,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {record.command_output || "无输出"}
                  </pre>
                </div>
              ),
              width: 800,
              okText: "关闭",
            });
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space wrap>
            <Select
              placeholder="按设备筛选"
              style={{ width: 180 }}
              allowClear
              onChange={setDeviceFilter}
              value={deviceFilter}
              showSearch
              optionFilterProp="label"
            >
              {devices.map((d) => (
                <Option key={d.id} value={d.id} label={`${d.name} (${d.ip_address})`}>
                  {d.name} ({d.ip_address})
                </Option>
              ))}
            </Select>

            <Select
              placeholder="按设备类型"
              style={{ width: 120 }}
              allowClear
              onChange={setDeviceTypeFilter}
              value={deviceTypeFilter}
            >
              {DEVICE_TYPE_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>

            <Select
              placeholder="按设备类别"
              style={{ width: 120 }}
              allowClear
              onChange={setDeviceCategoryFilter}
              value={deviceCategoryFilter}
            >
              {DEVICE_CATEGORY_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>

            <Select
              placeholder="按状态筛选"
              style={{ width: 120 }}
              allowClear
              onChange={setStatusFilter}
              value={statusFilter}
            >
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
            </Select>

            <RangePicker
              placeholder={["开始时间", "结束时间"]}
              showTime={{ format: "HH:mm" }}
              format="YYYY-MM-DD HH:mm"
              value={timeRange}
              onChange={setTimeRange}
              allowClear
              style={{ width: 320 }}
            />

            <Input
              placeholder="搜索设备/命令"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={fetchRecords}
            />
          </Space>

          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchRecords}>
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, position: ["bottomCenter"], showTotal: (total) => `共 ${total} 条` }}
        bordered
      />
    </div>
  );
}
