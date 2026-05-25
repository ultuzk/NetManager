"""
数据库迁移脚本 v2：新增账号管理、日志管理、定时备份、设备监测相关表
运行方式: python -m backend.migrate_v2
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "netmanager.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print("数据库不存在，无需迁移")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 检查是否已迁移
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'")
    if cursor.fetchone():
        print("v2 迁移已完成，跳过")
        conn.close()
        return

    print("开始 v2 迁移...")

    # 1. 账号管理表
    cursor.execute("""
        CREATE TABLE admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'operator',
            real_name VARCHAR(50),
            email VARCHAR(100),
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT 1,
            last_login_time DATETIME,
            last_login_ip VARCHAR(50),
            permissions TEXT DEFAULT 'device_manage,group_manage,inspection_manage,backup_manage,ai_manage',
            created_at DATETIME,
            updated_at DATETIME
        )
    """)

    # 2. 操作日志表
    cursor.execute("""
        CREATE TABLE operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username VARCHAR(50),
            action VARCHAR(50) NOT NULL,
            target_type VARCHAR(50),
            target_id INTEGER,
            target_name VARCHAR(100),
            detail TEXT,
            ip_address VARCHAR(50),
            result VARCHAR(20) DEFAULT 'success',
            error_message TEXT,
            created_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES admin_users(id)
        )
    """)

    # 3. 连接日志表
    cursor.execute("""
        CREATE TABLE connection_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username VARCHAR(50),
            device_id INTEGER,
            device_name VARCHAR(100),
            device_ip VARCHAR(15),
            protocol VARCHAR(10),
            action VARCHAR(20),
            command TEXT,
            result VARCHAR(20) DEFAULT 'success',
            error_message TEXT,
            duration_seconds INTEGER,
            created_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES admin_users(id),
            FOREIGN KEY (device_id) REFERENCES devices(id)
        )
    """)

    # 4. 定时备份表
    cursor.execute("""
        CREATE TABLE scheduled_backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            backup_type VARCHAR(50) DEFAULT 'running-config',
            device_ids TEXT,
            group_ids TEXT,
            device_type VARCHAR(20),
            device_category VARCHAR(20),
            interval_days INTEGER DEFAULT 7,
            hour INTEGER DEFAULT 2,
            minute INTEGER DEFAULT 0,
            enabled BOOLEAN DEFAULT 1,
            last_run_time DATETIME,
            next_run_time DATETIME,
            last_result VARCHAR(20),
            last_message TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
    """)

    # 5. 创建索引
    cursor.execute("CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at)")
    cursor.execute("CREATE INDEX idx_operation_logs_username ON operation_logs(username)")
    cursor.execute("CREATE INDEX idx_connection_logs_created_at ON connection_logs(created_at)")
    cursor.execute("CREATE INDEX idx_connection_logs_device_id ON connection_logs(device_id)")

    conn.commit()
    conn.close()
    print("v2 迁移完成！")

if __name__ == "__main__":
    migrate()
