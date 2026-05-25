// 公共常量
export const DEVICE_TYPE_OPTIONS = [
  { value: "huawei", label: "华为" },
  { value: "h3c", label: "H3C" },
  { value: "ruijie", label: "锐捷" },
  { value: "cisco", label: "Cisco" },
];

export const DEVICE_CATEGORY_OPTIONS = [
  { value: "switch", label: "交换机" },
  { value: "router", label: "路由器" },
  { value: "firewall", label: "防火墙" },
  { value: "ap", label: "无线AP" },
  { value: "controller", label: "无线控制器" },
];

export const PROTOCOL_OPTIONS = [
  { value: "ssh", label: "SSH" },
  { value: "telnet", label: "Telnet" },
];

export const BACKUP_TYPE_OPTIONS = [
  { value: "running-config", label: "运行配置" },
  { value: "startup-config", label: "启动配置" },
];

export const STATUS_MAP = {
  success: { color: "success", text: "成功" },
  failed: { color: "error", text: "失败" },
  pending: { color: "default", text: "等待中" },
  running: { color: "processing", text: "执行中" },
  online: { color: "success", text: "在线" },
  offline: { color: "error", text: "离线" },
  unknown: { color: "warning", text: "未知" },
};

export const INSPECTION_DEVICE_TYPE_OPTIONS = [
  { value: "huawei", label: "华为" },
  { value: "h3c", label: "H3C" },
  { value: "ruijie", label: "锐捷" },
  { value: "cisco", label: "Cisco" },
  { value: "all", label: "全部" },
];
