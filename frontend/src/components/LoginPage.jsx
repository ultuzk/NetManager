import { useState } from "react";
import { Form, Input, Button, Card, Typography, message, ConfigProvider, theme } from "antd";
import { UserOutlined, LockOutlined, GlobalOutlined } from "@ant-design/icons";
import { authAPI } from "../services/api";

const { Title, Text } = Typography;

const loginTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#6366f1",
    borderRadius: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif',
  },
  components: {
    Input: {
      borderRadius: 10,
      controlHeight: 44,
    },
    Button: {
      borderRadius: 10,
      controlHeight: 44,
      primaryShadow: '0 2px 8px rgba(99,102,241,0.25)',
    },
  },
};

export default function LoginPage({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const res = await authAPI.login({
        username: values.username,
        password: values.password,
      });
      if (res.success) {
        message.success("登录成功");
        // 保存用户信息到 sessionStorage
        sessionStorage.setItem("user", JSON.stringify(res.data));
        sessionStorage.setItem("isLoggedIn", "true");
        onLoginSuccess(res.data);
      } else {
        message.error(res.message || "登录失败");
      }
    } catch (error) {
      message.error(error.response?.data?.message || "登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={loginTheme}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 装饰性背景圆 */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-5%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(99,102,241,0.15)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            left: "-5%",
            width: 350,
            height: 350,
            borderRadius: "50%",
            background: "rgba(139,92,246,0.12)",
            filter: "blur(80px)",
          }}
        />

        <div style={{ width: 420, maxWidth: "90vw", position: "relative", zIndex: 1 }}>
          {/* Logo & 标题 */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
              }}
            >
              <GlobalOutlined style={{ fontSize: 28, color: "#fff" }} />
            </div>
            <Title level={2} style={{ color: "#fff", margin: 0, fontWeight: 700 }}>
              NetManager
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              智能网络统一管理平台
            </Text>
          </div>

          {/* 登录卡片 */}
          <Card
            bordered={false}
            style={{
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(20px)",
            }}
            bodyStyle={{ padding: "32px 36px" }}
          >
            <div style={{ marginBottom: 24 }}>
              <Title level={4} style={{ margin: 0, color: "#1e293b" }}>
                账号登录
              </Title>
              <Text style={{ color: "#94a3b8", fontSize: 13 }}>
                请输入您的管理员账号和密码
              </Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleLogin}
              autoComplete="off"
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: "请输入用户名" }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                  placeholder="请输入用户名"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: "请输入密码" }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
                  placeholder="请输入密码"
                  size="large"
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading}
                  style={{
                    fontWeight: 600,
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    border: "none",
                  }}
                >
                  {loading ? "登录中..." : "登 录"}
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* 底部版权 */}
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
              NetManager © 2026 · 智能网络统一管理平台
            </Text>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
