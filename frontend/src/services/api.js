import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  if (config.url && config.url.includes("/import/")) {
    console.log("[IMPORT REQUEST]", JSON.stringify(config.data, null, 2));
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("API Error:", error);
    if (error?.response) {
      console.error("API Error Response:", JSON.stringify(error.response.data, null, 2));
      // 构造包含后端详细信息的错误消息
      const detail = error.response.data?.detail;
      if (detail) {
        if (Array.isArray(detail)) {
          // Pydantic 验证错误: [{loc, msg, type}, ...]
          const msgs = detail.map(d => {
            const field = d.loc?.join('.') || '未知字段';
            return `${field}: ${d.msg}`;
          });
          error.message = `请求参数错误: ${msgs.join('; ')}`;
        } else if (typeof detail === 'string') {
          error.message = detail;
        }
      }
    }
    throw error;
  }
);

export const deviceAPI = {
  getDevices: (params = {}) => api.get("/devices/", { params }),
  getDevice: (id) => api.get(`/devices/${id}/`),
  createDevice: (data) => api.post("/devices/", data),
  updateDevice: (id, data) => api.put(`/devices/${id}/`, data),
  deleteDevice: (id) => api.delete(`/devices/${id}/`),
  testConnection: (id) => api.post(`/devices/${id}/test/`),
  executeCommand: (id, command) =>
    api.post(`/devices/${id}/cli/`, { command }),
  importDevices: (data) => api.post("/devices/import/", data),
  exportDevices: () => api.get("/devices/export/"),
  executeTraceroute: (deviceId, targetIp) =>
    api.post(`/devices/${deviceId}/traceroute/`, null, {
      params: { target_ip: targetIp },
    }),
  queryDeviceLogs: (deviceId, logType = "syslog", lines = 100) =>
    api.post(`/devices/${deviceId}/logs/`, null, {
      params: { log_type: logType, lines },
    }),
};

export const groupAPI = {
  getGroups: async () => {
    const res = await api.get("/groups/");
    // 后端返回 ResponseModel {success, message, data: [...]}
    // 统一解构，兼容直接返回数组的情况
    if (res && typeof res === "object" && !Array.isArray(res) && "data" in res) {
      return res.data || [];
    }
    return Array.isArray(res) ? res : [];
  },
  getGroup: async (id) => {
    const res = await api.get(`/groups/${id}/`);
    if (res && typeof res === "object" && !Array.isArray(res) && "data" in res) {
      return res.data || res;
    }
    return res;
  },
  createGroup: async (data) => {
    const res = await api.post("/groups/", data);
    return res?.data ?? res;
  },
  updateGroup: async (id, data) => {
    const res = await api.put(`/groups/${id}/`, data);
    return res?.data ?? res;
  },
  deleteGroup: (id) => api.delete(`/groups/${id}/`),
  searchDevices: async (params = {}) => {
    const res = await api.get("/groups/devices/search/", { params });
    if (res && typeof res === "object" && !Array.isArray(res) && "data" in res) {
      return res.data || { total: 0, items: [] };
    }
    return res || { total: 0, items: [] };
  },
  
  // 便捷方法：获取 groups 数组（自动从 {success, data} 解构）
  getGroupsList: async () => {
    const res = await api.get("/groups/");
    if (res && typeof res === "object" && !Array.isArray(res) && "data" in res) {
      return res.data || [];
    }
    return Array.isArray(res) ? res : [];
  },
};

export const inspectionAPI = {
  getCommands: (params = {}) =>
    api.get("/inspection/commands/", { params }),
  createCommand: (data) => api.post("/inspection/commands/", data),
  updateCommand: (id, data) =>
    api.put(`/inspection/commands/${id}/`, data),
  deleteCommand: (id) => api.delete(`/inspection/commands/${id}/`),
  executeInspection: (deviceId) =>
    api.post(`/inspection/execute/${deviceId}/`),
  executeBatchInspection: (data) =>
    api.post("/inspection/execute/batch/", data),
  executeSingleCommand: (commandId, data) =>
    api.post(`/inspection/execute/command/${commandId}/`, data),
  getRecords: (params = {}) => {
    // 转换时间参数：dayjs 对象 -> ISO 字符串
    const apiParams = { ...params };
    if (apiParams.start_time && typeof apiParams.start_time === 'object') {
      apiParams.start_time = apiParams.start_time.toISOString();
    }
    if (apiParams.end_time && typeof apiParams.end_time === 'object') {
      apiParams.end_time = apiParams.end_time.toISOString();
    }
    return api.get("/inspection/records/", { params: apiParams });
  },
  exportRecords: (params = {}) => {
    const apiParams = { ...params };
    if (apiParams.start_time && typeof apiParams.start_time === 'object') {
      apiParams.start_time = apiParams.start_time.toISOString();
    }
    if (apiParams.end_time && typeof apiParams.end_time === 'object') {
      apiParams.end_time = apiParams.end_time.toISOString();
    }
    return api.get("/inspection/export/", { params: apiParams, responseType: "text" });
  },
};

export const backupAPI = {
  executeBackup: (deviceId, backupType = "running-config") =>
    api.post("/backups/", {
      device_id: deviceId,
      backup_type: backupType,
    }),
  getBackups: (params = {}) => api.get("/backups/", { params }),
  getBackup: (id) => api.get(`/backups/${id}/`),
  deleteBackup: (id) => api.delete(`/backups/${id}/`),
  compareBackups: (id1, id2) =>
    api.post("/backups/compare/", null, {
      params: { backup_id1: id1, backup_id2: id2 },
    }),
  restoreBackup: (id) => api.post(`/backups/${id}/restore/`),
  executeBatchBackup: (deviceIds, backupType = "running-config") =>
    api.post("/backups/batch/", {
      device_ids: deviceIds,
      backup_type: backupType,
    }),
};

export const toolsAPI = {
  ping: (target, count = 4) =>
    api.post("/tools/ping/", { target, count }),
  traceroute: (target) =>
    api.post("/tools/traceroute/", { target }),
  deviceTraceroute: (deviceId, target) =>
    api.post("/tools/device-traceroute/", null, {
      params: { device_id: deviceId, target },
    }),
  tcpPing: (target, port = 80, count = 4) =>
    api.post("/tools/tcping/", { target, port, count }),
  udpPing: (target, port = 53, count = 4) =>
    api.post("/tools/udpping/", { target, port, count }),
  dns: (domain, dnsServer) =>
    api.post("/tools/dns/", { domain, dns_server: dnsServer }),
  whois: (domain) =>
    api.post("/tools/whois/", { domain }),
  portScan: (target, ports) =>
    api.post("/tools/port-scan/", null, { params: { target, ports } }),
  batchPing: (targets, count = 4) =>
    api.post("/tools/ping/batch/", { targets, count }),
  batchDns: (domains, dnsServer) =>
    api.post("/tools/dns/batch/", { domains, dns_server: dnsServer }),
};

export const authAPI = {
  login: (data) => api.post("/auth/login/", data),
  logout: (params) => api.post("/auth/logout/", null, { params }),
  getUsers: (params = {}) => api.get("/auth/users/", { params }),
  getUser: (id) => api.get(`/auth/users/${id}/`),
  createUser: (data) => api.post("/auth/users/", data),
  updateUser: (id, data) => api.put(`/auth/users/${id}/`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}/`),
};

export const logAPI = {
  getOperationLogs: (params = {}) => api.get("/logs/operations/", { params }),
  getConnectionLogs: (params = {}) => api.get("/logs/connections/", { params }),
  cleanupLogs: (days) => api.post("/logs/cleanup/", null, { params: { days } }),
};

export const scheduledBackupAPI = {
  getAll: () => api.get("/scheduled-backups/"),
  get: (id) => api.get(`/scheduled-backups/${id}/`),
  create: (data) => api.post("/scheduled-backups/", data),
  update: (id, data) => api.put(`/scheduled-backups/${id}/`, data),
  delete: (id) => api.delete(`/scheduled-backups/${id}/`),
  runNow: (id) => api.post(`/scheduled-backups/${id}/run/`),
};

export const aiAPI = {
  getConfig: () => api.get("/ai/config/"),
  updateConfig: (data) => api.post("/ai/config/", data),
  testConnection: () => api.post("/ai/config/test/"),
  analyzeLog: (deviceId, logContent) =>
    api.post("/ai/analyze/", {
      device_id: deviceId,
      log_content: logContent,
    }),
  chat: (message) =>
    api.post("/ai/chat/", { message }),
  getAnalysisRecords: (params = {}) =>
    api.get("/ai/analysis-records/", { params }),
  getPrompts: () => api.get("/ai/prompts/"),
  updatePrompts: (data) => api.post("/ai/prompts/", data),
};
