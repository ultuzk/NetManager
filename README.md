# 网络设备统一管理平台 (NetManager)

基于 **FastAPI + React** 的企业级网络设备统一管理平台，支持华为、H3C、锐捷、Cisco 等多种厂商设备的集中管理、自动巡检、配置备份和 AI 智能分析。

---

## 功能概览

### 📊 首页概览
- 设备总数、在线/离线/未知状态统计
- 备份状态总览（成功/失败/近7天）
- 巡检记录趋势

### 🖥️ 设备管理
- 支持设备类型：华为、H3C、锐捷、Cisco
- 支持设备类别：交换机、路由器、防火墙、无线AP、无线控制器
- SSH / Telnet 双协议连接
- 设备连接测试（延迟检测）
- 批量导入 / 导出（Excel/CSV）
- 设备分组关联（多对多）
- 实时设备在线状态监测（每 5 分钟自动检测）

### 📁 分组管理
- 自定义设备分组
- 分组下设备关联管理
- 按分组筛选和批量操作

### 🔍 设备巡检
- 巡检命令模板管理（按设备类型分类）
- 单设备巡检 / 批量巡检 / 按分组巡检
- 巡检记录查看与导出
- 后台异步执行，不阻塞前端

### 💾 备份管理
- 运行配置备份（running-config）
- 启动配置备份（startup-config）
- 批量备份 / 按分组备份
- 备份内容查看与下载
- 配置比对（diff）
- 配置恢复
- 定时备份调度（按天/按设备/按分组）

### 🛠️ 运维工具
- Ping / Traceroute
- TCP Ping / UDP Ping
- DNS 查询 / WHOIS
- 端口扫描
- 批量 Ping / 批量 DNS

### 🤖 AI 智能分析
- 支持 OpenAI / Azure / Anthropic / DeepSeek / 自定义 API
- 日志智能分析（故障识别、告警分级）
- AI 对话助手
- 提示词模板配置

### 👤 账号管理
- 管理员 / 操作员 / 观察者 三级角色
- 细粒度权限控制（设备管理、分组管理、巡检管理、备份管理、AI管理、系统管理）

### 📝 日志管理
- 操作日志（登录/登出/增删改查）
- 连接日志（SSH/Telnet 连接记录、命令执行记录）
- 日志清理策略

---

## 技术栈

### 后端
| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | **FastAPI** 0.104+ | 高性能异步 Web 框架 |
| ORM | **SQLAlchemy** 2.0.23 | 数据库 ORM |
| 数据库 | **SQLite** | 嵌入式数据库，无需额外部署 |
| SSH/Telnet | **Paramiko** 3.3+ | SSH 连接库 |
| 加密 | **cryptography** (Fernet) | 设备密码加密存储 |
| 服务器 | **Uvicorn** 0.24+ | ASGI 服务器 |

### 前端
| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | **React** 18.2 | UI 框架 |
| 组件库 | **Ant Design** 5.12 | 企业级 UI 组件 |
| 构建工具 | **Vite** 5.0 | 前端构建工具 |
| HTTP 客户端 | **Axios** 1.6 | API 请求封装 |
| 表格/Excel | **XLSX** 0.18 | Excel 导入导出 |
| 终端 | **xterm.js** 5.3 | Web 终端（CLI 连接） |
| 日期处理 | **dayjs** 1.11 | 日期格式化 |

---

## 项目结构

```
├── backend/                        # 后端代码
│   ├── main.py                     # 应用入口（FastAPI 启动、WebSocket、生命周期）
│   ├── database.py                 # 数据库配置（SQLite + Fernet 加密）
│   ├── models.py                   # SQLAlchemy 数据模型
│   │   ├── AdminUser               # 管理员账号
│   │   ├── Device                  # 设备
│   │   ├── DeviceGroup             # 设备分组
│   │   ├── Backup                  # 备份记录
│   │   ├── ScheduledBackup         # 定时备份配置
│   │   ├── InspectionCommand       # 巡检命令模板
│   │   ├── InspectionRecord        # 巡检记录
│   │   ├── AIConfig                # AI 服务配置
│   │   ├── AILogAnalysis           # AI 分析记录
│   │   ├── OperationLog            # 操作日志
│   │   └── ConnectionLog           # 连接日志
│   ├── schemas.py                  # Pydantic 请求/响应模型
│   ├── routers/                    # API 路由
│   │   ├── auth.py                 # 账号管理 / 登录登出
│   │   ├── devices.py              # 设备 CRUD / CLI / 导入导出
│   │   ├── groups.py               # 分组 CRUD / 设备搜索
│   │   ├── inspection.py           # 巡检命令 / 执行 / 记录
│   │   ├── backups.py              # 备份执行 / 比对 / 恢复
│   │   ├── scheduled_backups.py    # 定时备份 CRUD
│   │   ├── ai.py                   # AI 配置 / 分析 / 对话
│   │   ├── tools.py                # 运维工具（Ping/DNS/端口扫描等）
│   │   ├── logs.py                 # 日志查询 / 清理
│   │   └── cli.py                  # CLI WebSocket 路由
│   └── services/                   # 业务服务层
│       ├── auth_service.py         # 认证服务（SHA256 密码哈希）
│       ├── device_service.py       # 设备服务（SSH/Telnet 连接、命令执行）
│       ├── group_service.py        # 分组服务
│       ├── backup_service.py       # 备份服务
│       ├── inspection_service.py   # 巡检服务（异步线程池）
│       ├── cli_service.py          # CLI 会话管理（流式输出）
│       ├── device_monitor_service.py   # 设备在线监测（定时 ping）
│       ├── scheduled_backup_service.py # 定时备份调度器
│       ├── ai_service.py           # AI 服务（多厂商适配）
│       └── log_service.py          # 日志服务
│
├── frontend/                       # 前端代码
│   ├── src/
│   │   ├── main.jsx                # 入口文件
│   │   ├── App.jsx                 # 主应用（布局、路由、菜单）
│   │   ├── constants.js            # 常量（设备类型、状态映射等）
│   │   ├── index.css               # 全局样式
│   │   ├── components/             # 页面组件
│   │   │   ├── Dashboard.jsx       # 首页概览
│   │   │   ├── DeviceList.jsx      # 设备管理
│   │   │   ├── GroupList.jsx       # 分组管理
│   │   │   ├── InspectionPanel.jsx # 巡检面板（容器）
│   │   │   ├── InspectionCommands.jsx  # 巡检命令管理
│   │   │   ├── InspectionExecute.jsx   # 巡检执行
│   │   │   ├── InspectionRecords.jsx   # 巡检记录
│   │   │   ├── BackupPanel.jsx     # 备份管理（含定时备份）
│   │   │   ├── ScheduledBackupPanel.jsx # 定时备份面板
│   │   │   ├── ToolsPanel.jsx      # 运维工具
│   │   │   ├── AIConfigPanel.jsx   # AI 配置面板（容器）
│   │   │   ├── AIConfig.jsx        # AI 服务配置
│   │   │   ├── AILogAnalysis.jsx   # AI 日志分析
│   │   │   ├── AIChat.jsx          # AI 对话
│   │   │   ├── AIPrompts.jsx       # AI 提示词配置
│   │   │   ├── CLIConnection.jsx   # CLI 终端连接
│   │   │   ├── AccountManagement.jsx # 账号管理
│   │   │   ├── LogManagement.jsx   # 日志管理
│   │   │   └── LoginPage.jsx       # 登录页面
│   │   ├── services/
│   │   │   └── api.js              # API 封装（Axios 拦截器）
│   │   └── hooks/
│   │       └── useAIStatus.js      # AI 状态 Hook
│   ├── package.json                # 前端依赖
│   └── vite.config.js              # Vite 配置（含代理）
│
├── data/                           # 数据目录
│   ├── netmanager.db               # SQLite 数据库
│   └── netmanager.db.bak.*         # 数据库备份
├── .encryption_key                 # Fernet 加密密钥（自动生成）
├── requirements.txt                # Python 依赖
├── install_dependencies.sh         # 一键安装脚本
├── install_dependencies.py         # 一键安装脚本（Python 版）
├── start.sh / start.bat            # 启动脚本
├── stop.sh / stop.bat              # 停止脚本
├── restart.sh / restart.bat        # 重启脚本
├── start_backend.sh                # 仅启动后端
├── backend.log                     # 后端运行日志
├── frontend.log                    # 前端运行日志
└── 导入测试模板.xlsx               # 设备导入 Excel 模板
```

---

## 快速开始

### 环境要求
- **Python** 3.8+
- **Node.js** 18+

### 一键安装（推荐）

```bash
# Linux
bash install_dependencies.sh

# 或 Python 方式
python3 install_dependencies.py
```

### 手动安装

```bash
# 1. 安装 Python 依赖
pip3 install -r requirements.txt

# 2. 安装前端依赖
cd frontend
npm install
cd ..
```

### 启动服务

```bash
# 一键启动（前后端同时启动）
bash start.sh

# 或手动分别启动
# 终端 1：启动后端
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# 终端 2：启动前端
cd frontend
npm run dev
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

### 默认账号

- 用户名：`admin`
- 密码：`admin`

---

## API 接口文档

启动服务后访问 http://localhost:8000/docs 查看完整的 Swagger 交互文档。

### 账号管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/login/` | 用户登录 |
| POST | `/api/auth/logout/` | 用户登出 |
| GET | `/api/auth/users/` | 获取用户列表 |
| POST | `/api/auth/users/` | 创建用户 |
| PUT | `/api/auth/users/{id}/` | 更新用户 |
| DELETE | `/api/auth/users/{id}/` | 删除用户 |

### 设备管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/devices/` | 获取设备列表（支持搜索/筛选） |
| POST | `/api/devices/` | 创建设备 |
| GET | `/api/devices/{id}/` | 获取设备详情 |
| PUT | `/api/devices/{id}/` | 更新设备 |
| DELETE | `/api/devices/{id}/` | 删除设备 |
| POST | `/api/devices/{id}/test/` | 测试设备连接 |
| POST | `/api/devices/{id}/cli/` | 执行 CLI 命令 |
| POST | `/api/devices/{id}/logs/` | 查询设备日志 |
| POST | `/api/devices/{id}/traceroute/` | 路由跟踪 |
| POST | `/api/devices/import/` | 批量导入设备 |
| GET | `/api/devices/export/` | 导出设备列表 |
| WS | `/ws/cli/{device_id}` | CLI 交互式 WebSocket |

### 分组管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/groups/` | 获取分组列表 |
| POST | `/api/groups/` | 创建分组 |
| GET | `/api/groups/{id}/` | 获取分组详情 |
| PUT | `/api/groups/{id}/` | 更新分组 |
| DELETE | `/api/groups/{id}/` | 删除分组 |
| GET | `/api/groups/devices/search/` | 搜索设备（分组关联用） |

### 设备巡检
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/inspection/commands/` | 获取巡检命令列表 |
| POST | `/api/inspection/commands/` | 创建巡检命令 |
| PUT | `/api/inspection/commands/{id}/` | 更新巡检命令 |
| DELETE | `/api/inspection/commands/{id}/` | 删除巡检命令 |
| POST | `/api/inspection/execute/{device_id}/` | 单设备巡检 |
| POST | `/api/inspection/execute/batch/` | 批量巡检 |
| POST | `/api/inspection/execute/command/{command_id}/` | 单命令巡检 |
| GET | `/api/inspection/records/` | 获取巡检记录 |
| GET | `/api/inspection/export/` | 导出巡检记录 |

### 备份管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/backups/` | 执行单设备备份 |
| POST | `/api/backups/batch/` | 批量备份 |
| GET | `/api/backups/` | 获取备份记录 |
| GET | `/api/backups/{id}/` | 获取备份详情 |
| DELETE | `/api/backups/{id}/` | 删除备份 |
| POST | `/api/backups/compare/` | 配置比对 |
| POST | `/api/backups/{id}/restore/` | 配置恢复 |

### 定时备份
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/scheduled-backups/` | 获取定时备份列表 |
| POST | `/api/scheduled-backups/` | 创建定时备份 |
| PUT | `/api/scheduled-backups/{id}/` | 更新定时备份 |
| DELETE | `/api/scheduled-backups/{id}/` | 删除定时备份 |
| POST | `/api/scheduled-backups/{id}/run/` | 立即执行 |

### 运维工具
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/tools/ping/` | Ping 检测 |
| POST | `/api/tools/ping/batch/` | 批量 Ping |
| POST | `/api/tools/traceroute/` | Traceroute |
| POST | `/api/tools/device-traceroute/` | 从设备发起 Traceroute |
| POST | `/api/tools/tcping/` | TCP Ping |
| POST | `/api/tools/udpping/` | UDP Ping |
| POST | `/api/tools/dns/` | DNS 查询 |
| POST | `/api/tools/dns/batch/` | 批量 DNS 查询 |
| POST | `/api/tools/whois/` | WHOIS 查询 |
| POST | `/api/tools/port-scan/` | 端口扫描 |

### AI 服务
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/ai/config/` | 获取 AI 配置 |
| POST | `/api/ai/config/` | 更新 AI 配置 |
| POST | `/api/ai/config/test/` | 测试 AI 连接 |
| POST | `/api/ai/analyze/` | 日志智能分析 |
| POST | `/api/ai/chat/` | AI 对话 |
| GET | `/api/ai/analysis-records/` | 获取分析记录 |
| GET | `/api/ai/prompts/` | 获取提示词配置 |
| POST | `/api/ai/prompts/` | 更新提示词配置 |

### 日志管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/logs/operations/` | 获取操作日志 |
| GET | `/api/logs/connections/` | 获取连接日志 |
| POST | `/api/logs/cleanup/` | 清理过期日志 |

---

## 数据模型

### 核心实体关系

```
Device ←──多对多──→ DeviceGroup
  │
  ├──一对多──→ Backup
  ├──一对多──→ InspectionRecord
  └──一对多──→ ConnectionLog

AdminUser ←──一对多──→ OperationLog

ScheduledBackup → 独立调度配置

AIConfig → 全局单例配置
AILogAnalysis → AI 分析记录
```

### 设备字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| name | String | 设备名称 |
| ip_address | String | IP 地址 |
| username | String | 登录用户名 |
| password | String | 登录密码（Fernet 加密存储） |
| protocol | String | 连接协议：ssh / telnet |
| port | Integer | 端口号（默认 22） |
| device_type | String | 设备类型：huawei / h3c / ruijie / cisco |
| device_category | String | 设备类别：switch / router / firewall / ap / controller |
| connection_status | String | 连接状态：unknown / success / failed / testing |
| last_latency | Float | 最近检测延迟（ms） |
| groups | ManyToMany | 关联分组 |

---

## 安全设计

- **密码加密**：设备登录密码使用 Fernet 对称加密存储，密钥保存在 `.encryption_key` 文件（权限 600）
- **命令过滤**：CLI 命令执行前经过危险命令黑名单检测（reboot/shutdown/format/delete/erase 等）
- **分级权限**：admin / operator / viewer 三级角色，细粒度权限控制
- **操作审计**：所有操作记录到 OperationLog，支持追溯

---

## 运维命令

```bash
# 启动服务
bash start.sh

# 停止服务
bash stop.sh

# 重启服务
bash restart.sh

# 仅启动后端
bash start_backend.sh

# 查看后端日志
tail -f backend.log

# 查看前端日志
tail -f frontend.log
```

---

## 注意事项

1. **首次启动**：后端会自动创建数据库表、默认 admin 账号和 AI 配置
2. **设备密码**：数据库中存储的是加密密码，即使数据库泄露也无法直接获取明文
3. **定时任务**：设备在线监测（5分钟）和定时备份调度在应用启动时自动运行
4. **CLI 连接**：通过 WebSocket 实现交互式终端，支持 SSH 和 Telnet 协议
5. **AI 功能**：需要配置有效的 AI 服务 API Key 才能使用
6. **数据备份**：数据库文件位于 `data/netmanager.db`，建议定期备份

---

*NetManager © 2026 · 智能网络统一管理平台*
