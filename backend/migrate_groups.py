"""
数据库迁移脚本：将设备分组从单外键(group_id)改为多对多关系
运行方式: python -m backend.migrate_groups
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

    # 检查是否已经迁移
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='device_group_association'")
    if cursor.fetchone():
        print("迁移已完成，跳过")
        conn.close()
        return

    # 检查旧表是否有 group_id 列
    cursor.execute("PRAGMA table_info(devices)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'group_id' not in columns:
        print("旧 group_id 列不存在，可能已迁移")
        conn.close()
        return

    print("开始迁移...")

    # 1. 创建多对多关联表
    cursor.execute("""
        CREATE TABLE device_group_association (
            device_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            PRIMARY KEY (device_id, group_id),
            FOREIGN KEY (device_id) REFERENCES devices(id),
            FOREIGN KEY (group_id) REFERENCES device_groups(id)
        )
    """)

    # 2. 将旧的 group_id 数据迁移到关联表
    cursor.execute("SELECT id, group_id FROM devices WHERE group_id IS NOT NULL")
    rows = cursor.fetchall()
    for device_id, group_id in rows:
        cursor.execute(
            "INSERT OR IGNORE INTO device_group_association (device_id, group_id) VALUES (?, ?)",
            (device_id, group_id)
        )
        print(f"  迁移: device_id={device_id} -> group_id={group_id}")

    # 3. 删除旧 group_id 列（SQLite 需要重建表）
    # 获取当前表结构
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='devices'")
    old_sql = cursor.fetchone()[0]

    # 创建新表（不含 group_id）
    cursor.execute("""
        CREATE TABLE devices_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            ip_address VARCHAR(15) NOT NULL,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(100) NOT NULL,
            protocol VARCHAR(10) DEFAULT 'ssh',
            port INTEGER DEFAULT 22,
            device_type VARCHAR(20) DEFAULT 'auto',
            device_category VARCHAR(20) DEFAULT 'switch',
            connection_status VARCHAR(20) DEFAULT 'unknown',
            last_latency FLOAT,
            last_test_time DATETIME,
            last_inspection_time DATETIME,
            password_expire_date DATETIME,
            description TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
    """)

    # 复制数据
    cursor.execute("""
        INSERT INTO devices_new 
        (id, name, ip_address, username, password, protocol, port, device_type, device_category,
         connection_status, last_latency, last_test_time, last_inspection_time, password_expire_date,
         description, created_at, updated_at)
        SELECT id, name, ip_address, username, password, protocol, port, device_type, device_category,
         connection_status, last_latency, last_test_time, last_inspection_time, password_expire_date,
         description, created_at, updated_at FROM devices
    """)

    # 删除旧表，重命名新表
    cursor.execute("DROP TABLE devices")
    cursor.execute("ALTER TABLE devices_new RENAME TO devices")

    conn.commit()
    conn.close()
    print(f"迁移完成！共迁移 {len(rows)} 条设备-分组关联")

if __name__ == "__main__":
    migrate()
