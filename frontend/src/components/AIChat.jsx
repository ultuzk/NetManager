import { useState, useEffect, useRef } from "react";
import {
  Card, Input, Button, message, Typography, Empty, Spin, Alert, Avatar, Divider,
} from "antd";
import {
  SendOutlined, DeleteOutlined, ExclamationCircleOutlined, UserOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import { aiAPI } from "../services/api";
import { useAIStatus } from "../hooks/useAIStatus";
import dayjs from "dayjs";

const { Text, Title } = Typography;
const { TextArea } = Input;

export default function AIChat() {
  const { aiEnabled, requireAI, checkStatus } = useAIStatus();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!requireAI()) return;
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
      time: dayjs().format("HH:mm:ss"),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // 使用 AI 服务的对话接口（复用 analyze 接口，传入对话内容）
      const result = await aiAPI.chat(userMessage.content);
      const aiMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: result.success
          ? (result.data?.reply || result.data?.analysis || result.data?.analysis_result || "分析完成")
          : `抱歉，处理失败：${result.message || "未知错误"}`,
        time: dayjs().format("HH:mm:ss"),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `抱歉，发生了错误：${error.message || "未知错误"}`,
        time: dayjs().format("HH:mm:ss"),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      {/* AI 服务状态提示 */}
      {!aiEnabled && (
        <Alert
          message="AI 服务未启用"
          description="请先在「配置管理」中配置 API 密钥并启用 AI 服务，才能使用 AI 对话功能。"
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={checkStatus}>
              刷新状态
            </Button>
          }
        />
      )}

      <Card
        bordered={false}
        style={{ borderRadius: 16, height: "calc(100vh - 220px)", display: "flex", flexDirection: "column" }}
        bodyStyle={{ padding: 0, flex: 1, display: "flex", flexDirection: "column" }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar
              size={36}
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
              icon={<ThunderboltOutlined />}
            />
            <div>
              <Text strong style={{ fontSize: 15 }}>AI 智能助手</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {aiEnabled ? "在线 · 随时为您服务" : "离线 · 请先配置 AI 服务"}
              </Text>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleClear}
              type="text"
            >
              清空对话
            </Button>
          )}
        </div>

        {/* 消息列表 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px",
            background: "#fafbfc",
          }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <Avatar
                size={64}
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  marginBottom: 16,
                }}
                icon={<ThunderboltOutlined style={{ fontSize: 28 }} />}
              />
              <Title level={4} style={{ color: "#1e293b", marginBottom: 8 }}>
                您好，我是 AI 智能助手
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                我可以帮助您分析设备日志、解答网络问题、提供配置建议
              </Text>
              <Divider style={{ margin: "24px auto", maxWidth: 400 }} />
              <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {["分析设备日志", "网络故障排查", "配置优化建议", "安全风险评估"].map((tip) => (
                  <Button
                    key={tip}
                    size="small"
                    style={{ borderRadius: 20, borderColor: "#6366f1", color: "#6366f1" }}
                    disabled={!aiEnabled}
                    onClick={() => setInput(tip)}
                  >
                    {tip}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    maxWidth: "75%",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  }}
                >
                  <Avatar
                    size={32}
                    style={{
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)"
                        : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      flexShrink: 0,
                    }}
                    icon={msg.role === "user" ? <UserOutlined /> : <ThunderboltOutlined />}
                  />
                  <div>
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                        background: msg.role === "user"
                          ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                          : "#ffffff",
                        color: msg.role === "user" ? "#ffffff" : "#1e293b",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                    >
                      {msg.content}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block", textAlign: msg.role === "user" ? "right" : "left" }}>
                      {msg.time}
                    </Text>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <Avatar
                  size={32}
                  style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
                  icon={<ThunderboltOutlined />}
                />
                <div style={{ padding: "12px 16px", borderRadius: "4px 16px 16px 16px", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ marginLeft: 8 }}>AI 正在思考...</Text>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f1f5f9",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={aiEnabled ? "输入您的问题，Enter 发送，Shift+Enter 换行..." : "请先配置 AI 服务..."}
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={!aiEnabled}
              style={{ borderRadius: 12, resize: "none" }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!aiEnabled || !input.trim() || loading}
              style={{ height: 40, minWidth: 40 }}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
            AI 助手基于您配置的 AI 服务运行 · 对话内容不会被保存
          </Text>
        </div>
      </Card>
    </div>
  );
}
