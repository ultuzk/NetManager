# Network Device Management Platform (NetManager)

An enterprise-grade network device management platform built with **FastAPI + React**, supporting centralized management, automated inspection, configuration backup, and AI-powered analysis for multi-vendor network devices (Huawei, H3C, Ruijie, Cisco).

---

## Features

### 📊 Dashboard
- Device overview: total, online, offline, and unknown status counts
- Backup status summary (success / failure / last 7 days)
- Inspection record trends

### 🖥️ Device Management
- Supported vendors: Huawei, H3C, Ruijie, Cisco
- Device categories: Switch, Router, Firewall, Wireless AP, Wireless Controller
- SSH / Telnet dual-protocol support
- Connection testing with latency detection
- Batch import / export (Excel/CSV)
- Multi-group device association (many-to-many)
- Automatic online status monitoring (every 5 minutes)

### 📁 Group Management
- Custom device groups
- Device-to-group association
- Filter and batch operations by group

### 🔍 Device Inspection
- Inspection command templates (categorized by device type)
- Single device / batch / group-based inspection
- Inspection record viewing and export
- Asynchronous background execution

### 💾 Backup Management
- Running-config backup
- Startup-config backup
- Batch backup / group-based backup
- Backup content viewing and download
- Configuration comparison (diff)
- Configuration restore
- Scheduled backup (daily / by device / by group)

### 🛠️ Network Tools
- Ping / Traceroute
- TCP Ping / UDP Ping
- DNS Lookup / WHOIS
- Port Scan
- Batch Ping / Batch DNS

### 🤖 AI Analysis
- Supports OpenAI / Azure / Anthropic / DeepSeek / Custom API
- Intelligent log analysis (fault detection, severity classification)
- AI chat assistant
- Prompt template configuration

### 👤 Account Management
- Three roles: Admin / Operator / Viewer
- Granular permissions (device, group, inspection, backup, AI, system management)

### 📝 Log Management
- Operation logs (login/logout/create/update/delete)
- Connection logs (SSH/Telnet sessions, command execution)
- Log cleanup policies

---

## Tech Stack

### Backend
| Component | Technology | Description |
|-----------|------------|-------------|
| Framework | **FastAPI** 0.104+ | High-performance async web framework |
| ORM | **SQLAlchemy** 2.0.23 | Database ORM |
| Database | **SQLite** | Embedded database, no separate deployment needed |
| SSH/Telnet | **Paramiko** 3.3+ | SSH connection library |
| Encryption | **cryptography** (Fernet) | Device password encryption at rest |
| Server | **Uvicorn** 0.24+ | ASGI server |

### Frontend
| Component | Technology | Description |
|-----------|------------|-------------|
| Framework | **React** 18.2 | UI framework |
| Component Library | **Ant Design** 5.12 | Enterprise UI components |
| Build Tool | **Vite** 5.0 | Frontend build tool |
| HTTP Client | **Axios** 1.6 | API request layer |
| Spreadsheet | **XLSX** 0.18 | Excel import/export |
| Terminal | **xterm.js** 5.3 | Web-based terminal (CLI) |
| Date Handling | **dayjs** 1.11 | Date formatting |

---

## Project Structure

```
├── backend/                        # Backend code
│   ├── main.py                     # Application entry (FastAPI, WebSocket, lifecycle)
│   ├── database.py                 # Database config (SQLite + Fernet encryption)
│   ├── models.py                   # SQLAlchemy data models
│   │   ├── AdminUser               # Admin accounts
│   │   ├── Device                  # Network devices
│   │   ├── DeviceGroup             # Device groups
│   │   ├── Backup                  # Backup records
│   │   ├── ScheduledBackup         # Scheduled backup config
│   │   ├── InspectionCommand       # Inspection command templates
│   │   ├── InspectionRecord        # Inspection records
│   │   ├── AIConfig                # AI service configuration
│   │   ├── AILogAnalysis           # AI analysis records
│   │   ├── OperationLog            # Operation logs
│   │   └── ConnectionLog           # Connection logs
│   ├── schemas.py                  # Pydantic request/response models
│   ├── routers/                    # API routes
│   │   ├── auth.py                 # Account management / login/logout
│   │   ├── devices.py              # Device CRUD / CLI / import/export
│   │   ├── groups.py               # Group CRUD / device search
│   │   ├── inspection.py           # Inspection commands / execution / records
│   │   ├── backups.py              # Backup execution / comparison / restore
│   │   ├── scheduled_backups.py    # Scheduled backup CRUD
│   │   ├── ai.py                   # AI config / analysis / chat
│   │   ├── tools.py                # Network tools (Ping/DNS/Port scan)
│   │   ├── logs.py                 # Log query / cleanup
│   │   └── cli.py                  # CLI WebSocket routes
│   └── services/                   # Business service layer
│       ├── auth_service.py         # Authentication (SHA256 password hashing)
│       ├── device_service.py       # Device service (SSH/Telnet, command execution)
│       ├── group_service.py        # Group service
│       ├── backup_service.py       # Backup service
│       ├── inspection_service.py   # Inspection service (async thread pool)
│       ├── cli_service.py          # CLI session management (streaming output)
│       ├── device_monitor_service.py   # Device online monitoring (scheduled ping)
│       ├── scheduled_backup_service.py # Scheduled backup scheduler
│       ├── ai_service.py           # AI service (multi-provider support)
│       └── log_service.py          # Logging service
│
├── frontend/                       # Frontend code
│   ├── src/
│   │   ├── main.jsx                # Entry point
│   │   ├── App.jsx                 # Main app (layout, routing, menu)
│   │   ├── constants.js            # Constants (device types, status mapping)
│   │   ├── index.css               # Global styles
│   │   ├── components/             # Page components
│   │   │   ├── Dashboard.jsx       # Dashboard
│   │   │   ├── DeviceList.jsx      # Device management
│   │   │   ├── GroupList.jsx       # Group management
│   │   │   ├── InspectionPanel.jsx # Inspection panel (container)
│   │   │   ├── InspectionCommands.jsx  # Inspection command management
│   │   │   ├── InspectionExecute.jsx   # Inspection execution
│   │   │   ├── InspectionRecords.jsx   # Inspection records
│   │   │   ├── BackupPanel.jsx     # Backup management (with scheduling)
│   │   │   ├── ScheduledBackupPanel.jsx # Scheduled backup panel
│   │   │   ├── ToolsPanel.jsx      # Network tools
│   │   │   ├── AIConfigPanel.jsx   # AI config panel (container)
│   │   │   ├── AIConfig.jsx        # AI service configuration
│   │   │   ├── AILogAnalysis.jsx   # AI log analysis
│   │   │   ├── AIChat.jsx          # AI chat
│   │   │   ├── AIPrompts.jsx       # AI prompt configuration
│   │   │   ├── CLIConnection.jsx   # CLI terminal connection
│   │   │   ├── AccountManagement.jsx # Account management
│   │   │   ├── LogManagement.jsx   # Log management
│   │   │   └── LoginPage.jsx       # Login page
│   │   ├── services/
│   │   │   └── api.js              # API layer (Axios interceptors)
│   │   └── hooks/
│   │       └── useAIStatus.js      # AI status hook
│   ├── package.json                # Frontend dependencies
│   └── vite.config.js              # Vite config (with proxy)
│
├── data/                           # Data directory
│   ├── netmanager.db               # SQLite database
│   └── netmanager.db.bak.*         # Database backups
├── .encryption_key                 # Fernet encryption key (auto-generated)
├── requirements.txt                # Python dependencies
├── install_dependencies.sh         # One-click install script
├── install_dependencies.py         # One-click install script (Python)
├── start.sh / start.bat            # Start script
├── stop.sh / stop.bat              # Stop script
├── restart.sh / restart.bat        # Restart script
├── start_backend.sh                # Start backend only
├── backend.log                     # Backend log
├── frontend.log                    # Frontend log
└── 导入测试模板.xlsx               # Device import Excel template
```

---

## Quick Start

### Prerequisites
- **Python** 3.8+
- **Node.js** 18+

### One-Click Install (Recommended)

```bash
# Linux
bash install_dependencies.sh

# Or via Python
python3 install_dependencies.py
```

### Manual Install

```bash
# 1. Install Python dependencies
pip3 install -r requirements.txt

# 2. Install frontend dependencies
cd frontend
npm install
cd ..
```

### Start Services

```bash
# Start both frontend and backend
bash start.sh

# Or start manually
# Terminal 1: Backend
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Default Credentials

- Username: `admin`
- Password: `admin123`

---

## API Reference

Visit http://localhost:8000/docs for the full Swagger interactive documentation.

### Account Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login/` | User login |
| POST | `/api/auth/logout/` | User logout |
| GET | `/api/auth/users/` | List users |
| POST | `/api/auth/users/` | Create user |
| PUT | `/api/auth/users/{id}/` | Update user |
| DELETE | `/api/auth/users/{id}/` | Delete user |

### Device Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices/` | List devices (search/filter supported) |
| POST | `/api/devices/` | Create device |
| GET | `/api/devices/{id}/` | Get device details |
| PUT | `/api/devices/{id}/` | Update device |
| DELETE | `/api/devices/{id}/` | Delete device |
| POST | `/api/devices/{id}/test/` | Test connection |
| POST | `/api/devices/{id}/cli/` | Execute CLI command |
| POST | `/api/devices/{id}/logs/` | Query device logs |
| POST | `/api/devices/{id}/traceroute/` | Traceroute |
| POST | `/api/devices/import/` | Batch import devices |
| GET | `/api/devices/export/` | Export device list |
| WS | `/ws/cli/{device_id}` | CLI interactive WebSocket |

### Group Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups/` | List groups |
| POST | `/api/groups/` | Create group |
| GET | `/api/groups/{id}/` | Get group details |
| PUT | `/api/groups/{id}/` | Update group |
| DELETE | `/api/groups/{id}/` | Delete group |
| GET | `/api/groups/devices/search/` | Search devices (for group association) |

### Device Inspection
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inspection/commands/` | List inspection commands |
| POST | `/api/inspection/commands/` | Create inspection command |
| PUT | `/api/inspection/commands/{id}/` | Update inspection command |
| DELETE | `/api/inspection/commands/{id}/` | Delete inspection command |
| POST | `/api/inspection/execute/{device_id}/` | Single device inspection |
| POST | `/api/inspection/execute/batch/` | Batch inspection |
| POST | `/api/inspection/execute/command/{command_id}/` | Single command inspection |
| GET | `/api/inspection/records/` | List inspection records |
| GET | `/api/inspection/export/` | Export inspection records |

### Backup Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/backups/` | Execute single device backup |
| POST | `/api/backups/batch/` | Batch backup |
| GET | `/api/backups/` | List backup records |
| GET | `/api/backups/{id}/` | Get backup details |
| DELETE | `/api/backups/{id}/` | Delete backup |
| POST | `/api/backups/compare/` | Compare configurations |
| POST | `/api/backups/{id}/restore/` | Restore configuration |

### Scheduled Backup
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scheduled-backups/` | List scheduled backups |
| POST | `/api/scheduled-backups/` | Create scheduled backup |
| PUT | `/api/scheduled-backups/{id}/` | Update scheduled backup |
| DELETE | `/api/scheduled-backups/{id}/` | Delete scheduled backup |
| POST | `/api/scheduled-backups/{id}/run/` | Run immediately |

### Network Tools
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tools/ping/` | Ping |
| POST | `/api/tools/ping/batch/` | Batch Ping |
| POST | `/api/tools/traceroute/` | Traceroute |
| POST | `/api/tools/device-traceroute/` | Traceroute from device |
| POST | `/api/tools/tcping/` | TCP Ping |
| POST | `/api/tools/udpping/` | UDP Ping |
| POST | `/api/tools/dns/` | DNS Lookup |
| POST | `/api/tools/dns/batch/` | Batch DNS Lookup |
| POST | `/api/tools/whois/` | WHOIS |
| POST | `/api/tools/port-scan/` | Port Scan |

### AI Services
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/config/` | Get AI configuration |
| POST | `/api/ai/config/` | Update AI configuration |
| POST | `/api/ai/config/test/` | Test AI connection |
| POST | `/api/ai/analyze/` | Log analysis |
| POST | `/api/ai/chat/` | AI chat |
| GET | `/api/ai/analysis-records/` | List analysis records |
| GET | `/api/ai/prompts/` | Get prompt templates |
| POST | `/api/ai/prompts/` | Update prompt templates |

### Log Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs/operations/` | List operation logs |
| GET | `/api/logs/connections/` | List connection logs |
| POST | `/api/logs/cleanup/` | Cleanup old logs |

---

## Data Model

### Core Entity Relationships

```
Device ←──many-to-many──→ DeviceGroup
  │
  ├──one-to-many──→ Backup
  ├──one-to-many──→ InspectionRecord
  └──one-to-many──→ ConnectionLog

AdminUser ←──one-to-many──→ OperationLog

ScheduledBackup → standalone scheduling config

AIConfig → global singleton config
AILogAnalysis → AI analysis records
```

### Device Fields

| Field | Type | Description |
|-------|------|-------------|
| name | String | Device name |
| ip_address | String | IP address |
| username | String | Login username |
| password | String | Login password (Fernet encrypted at rest) |
| protocol | String | Connection protocol: ssh / telnet |
| port | Integer | Port number (default 22) |
| device_type | String | Vendor: huawei / h3c / ruijie / cisco |
| device_category | String | Category: switch / router / firewall / ap / controller |
| connection_status | String | Status: unknown / success / failed / testing |
| last_latency | Float | Last measured latency (ms) |
| groups | ManyToMany | Associated groups |

---

## Security

- **Password Encryption**: Device passwords are encrypted with Fernet symmetric encryption. The key is stored in `.encryption_key` (file permission 600).
- **Command Filtering**: CLI commands are checked against a dangerous command blacklist (reboot, shutdown, format, delete, erase, etc.) before execution.
- **Role-Based Access**: Three roles (admin / operator / viewer) with granular permission control.
- **Audit Trail**: All operations are recorded in OperationLog for full traceability.

---

## Operations

```bash
# Start services
bash start.sh

# Stop services
bash stop.sh

# Restart services
bash restart.sh

# Start backend only
bash start_backend.sh

# View backend logs
tail -f backend.log

# View frontend logs
tail -f frontend.log
```

---

## Notes

1. **First Launch**: The backend automatically creates database tables, a default admin account, and AI configuration.
2. **Device Passwords**: Passwords are stored encrypted. Even with database access, plaintext passwords cannot be retrieved.
3. **Scheduled Tasks**: Device online monitoring (5-min interval) and scheduled backup runner start automatically with the application.
4. **CLI Connection**: Interactive terminal via WebSocket, supporting both SSH and Telnet protocols.
5. **AI Features**: A valid AI service API Key is required to use AI features.
6. **Data Backup**: The database file is located at `data/netmanager.db`. Regular backups are recommended.

---

*NetManager © 2026 · Intelligent Network Management Platform*
