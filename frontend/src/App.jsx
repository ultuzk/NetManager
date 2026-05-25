import { useState, useEffect } from 'react';
import { Layout, Menu, Typography, theme, ConfigProvider, Avatar, Dropdown, Badge } from 'antd';
import {
  HddOutlined,
  FolderOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  DashboardOutlined, ToolOutlined,
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import DeviceList from './components/DeviceList';
import GroupList from './components/GroupList';
import InspectionPanel from './components/InspectionPanel';
import BackupPanel from './components/BackupPanel';
import AIConfigPanel from './components/AIConfigPanel';
import ToolsPanel from './components/ToolsPanel';
import AccountManagement from './components/AccountManagement';
import LogManagement from './components/LogManagement';
import LoginPage from './components/LoginPage';


const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

// AI 智能风格主题 — 浅色 + 蓝紫渐变
const customTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#6366f1',
    colorInfo: '#6366f1',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    wireframe: false,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#1e1b4b',
      headerPadding: '0 24px',
      headerHeight: 64,
    },
    Menu: {
      darkItemBg: 'transparent',
      darkItemHoverBg: 'rgba(255,255,255,0.08)',
      darkItemSelectedBg: 'rgba(99,102,241,0.25)',
      darkItemColor: 'rgba(255,255,255,0.65)',
      darkItemSelectedColor: '#ffffff',
      itemBorderRadius: 10,
      itemMarginInline: 8,
      itemMarginBlock: 4,
    },
    Card: {
      borderRadiusLG: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    },
    Table: {
      borderRadiusLG: 12,
      headerBg: '#f8fafc',
      headerColor: '#64748b',
      rowHoverBg: '#f1f5f9',
    },
    Button: {
      borderRadius: 10,
      controlHeight: 40,
      primaryShadow: '0 2px 8px rgba(99,102,241,0.25)',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Tag: {
      borderRadius: 6,
    },
    Statistic: {
      titleFontSize: 14,
      titleColor: '#94a3b8',
      contentFontSize: 28,
      contentFontWeight: 600,
    },
  },
};

function App() {
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('isLoggedIn') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true);
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('user');
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '首页概览' },
    { key: 'devices', icon: <HddOutlined />, label: '设备管理' },
    { key: 'groups', icon: <FolderOutlined />, label: '分组管理' },
    { key: 'inspection', icon: <FileSearchOutlined />, label: '设备巡检' },
    { key: 'backup', icon: <SaveOutlined />, label: '备份管理' },
    { key: 'ai', icon: <ThunderboltOutlined />, label: 'AI 分析' },
    { key: 'tools', icon: <ToolOutlined />, label: '运维工具' },
    { key: 'accounts', icon: <UserOutlined />, label: '账号管理' },
    { key: 'logs', icon: <HistoryOutlined />, label: '日志管理' },
  ];

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人设置' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard': return <Dashboard />;
      case 'devices': return <DeviceList />;
      case 'groups': return <GroupList />;
      case 'inspection': return <InspectionPanel />;
      case 'backup': return <BackupPanel />;
      case 'ai': return <AIConfigPanel />;
      case 'tools': return <ToolsPanel />;
      case 'accounts': return <AccountManagement />;
      case 'logs': return <LogManagement />;
      default: return <Dashboard />;
    }
  };

  const currentPageTitle = menuItems.find((m) => m.key === selectedKey)?.label || '首页概览';

  return (
    <ConfigProvider theme={customTheme}>
      <Layout style={{ minHeight: '100vh' }}>
        {/* 侧边栏 */}
        <Sider
          collapsible
          trigger={null}
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          width={220}
          collapsedWidth={64}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Logo */}
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: siderCollapsed ? 'center' : 'flex-start',
              padding: siderCollapsed ? 0 : '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GlobalOutlined style={{ fontSize: 18, color: '#fff' }} />
            </div>
            {!siderCollapsed && (
              <div style={{ marginLeft: 12, overflow: 'hidden' }}>
                <Text
                  strong
                  style={{
                    color: '#fff',
                    fontSize: 15,
                    whiteSpace: 'nowrap',
                  }}
                >
                  NetManager
                </Text>
                <br />
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  智能网络管理平台
                </Text>
              </div>
            )}
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{
              background: 'transparent',
              border: 'none',
              paddingTop: 8,
            }}
            onClick={(e) => setSelectedKey(e.key)}
          />

          {/* 底部 AI 标识 */}
          {!siderCollapsed && (
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                right: 16,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ThunderboltOutlined style={{ color: '#a78bfa', fontSize: 16 }} />
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>
                    AI 智能引擎
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                    已启用 · 运行中
                  </Text>
                </div>
              </div>
            </div>
          )}
        </Sider>

        {/* 主内容区 */}
        <Layout style={{ marginLeft: siderCollapsed ? 64 : 220, transition: 'margin-left 0.2s' }}>
          {/* 顶部导航 */}
          <Header
            style={{
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 64,
              padding: '0 24px',
              position: 'sticky',
              top: 0,
              zIndex: 99,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => setSiderCollapsed(!siderCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: '#64748b',
                  padding: 4,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
              <div>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>{currentPageTitle}</Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Badge count={0} size="small">
                <BellOutlined style={{ fontSize: 18, color: '#64748b', cursor: 'pointer' }} />
              </Badge>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 10,
                    transition: 'background 0.2s',
                  }}
                >
                  <Avatar
                    size={32}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      fontSize: 14,
                    }}
                  >
                    A
                  </Avatar>
                  <div style={{ lineHeight: 1.2 }}>
                    <Text strong style={{ fontSize: 13, display: 'block' }}>
                      {currentUser?.real_name || currentUser?.username || 'Admin'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                      {currentUser?.role === 'admin' ? '管理员' : currentUser?.role === 'operator' ? '操作员' : '用户'}
                    </Text>
                  </div>
                </div>
              </Dropdown>
            </div>
          </Header>

          {/* 内容区 */}
          <Content
            style={{
              padding: '24px',
              background: '#f8fafc',
              minHeight: 'calc(100vh - 64px)',
            }}
          >
            {renderContent()}
          </Content>

          {/* 底部 */}
          <Footer
            style={{
              textAlign: 'center',
              background: 'transparent',
              padding: '16px 24px',
              color: '#94a3b8',
              fontSize: 12,
            }}
          >
            NetManager © 2026 · 智能网络统一管理平台 · Powered by AI
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
