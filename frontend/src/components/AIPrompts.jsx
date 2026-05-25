import { useState, useEffect } from "react";
import {
  Card, Button, Input, Form, message, Space, Typography, Tag, Tooltip, Divider,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, ThunderboltOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;
const { Text, Title } = Typography;

const DEFAULT_PROMPTS = [
  {
    key: "log_analysis",
    name: "日志分析",
    description: "分析设备日志，识别异常和潜在问题",
    prompt: `你是一个专业的网络设备运维专家。请分析以下设备日志内容：

1. 识别日志中的异常、错误和警告信息
2. 分析可能的根本原因
3. 评估问题的严重程度（critical/high/medium/low/info）
4. 提供具体的解决建议

请按以下格式输出：
## 分析结果
[详细分析]

## 严重程度
[critical/high/medium/low/info]

## 建议操作
[具体建议]`,
  },
  {
    key: "config_review",
    name: "配置审查",
    description: "审查设备配置，发现潜在问题和优化建议",
    prompt: `你是一个专业的网络设备配置专家。请审查以下设备配置：

1. 检查配置中的安全隐患
2. 识别配置错误或不一致
3. 提供配置优化建议
4. 检查是否符合最佳实践

请按以下格式输出：
## 配置评估
[整体评估]

## 发现的问题
[问题列表]

## 优化建议
[具体建议]`,
  },
  {
    key: "troubleshooting",
    name: "故障排查",
    description: "根据故障现象提供排查思路和解决方案",
    prompt: `你是一个专业的网络故障排查专家。请根据以下故障信息：

1. 分析可能的故障原因（按可能性排序）
2. 提供详细的排查步骤
3. 给出解决方案
4. 提供预防措施

请按以下格式输出：
## 故障分析
[分析]

## 排查步骤
[步骤]

## 解决方案
[方案]

## 预防措施
[措施]`,
  },
  {
    key: "security_audit",
    name: "安全审计",
    description: "审计设备安全配置，发现安全风险",
    prompt: `你是一个网络安全专家。请审计以下设备配置的安全性：

1. 识别安全漏洞和风险点
2. 评估风险等级
3. 提供安全加固建议
4. 检查合规性

请按以下格式输出：
## 安全评估
[整体评估]

## 风险发现
[风险列表]

## 加固建议
[具体建议]`,
  },
];

export default function AIPrompts() {
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [editingKey, setEditingKey] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    // 从 localStorage 加载自定义提示词
    const saved = localStorage.getItem("ai_prompts");
    if (saved) {
      try {
        setPrompts(JSON.parse(saved));
      } catch (e) { /* 忽略 */ }
    }
  }, []);

  const handleEdit = (prompt) => {
    setEditingKey(prompt.key);
    form.setFieldsValue(prompt);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updated = prompts.map((p) =>
        p.key === editingKey ? { ...p, ...values } : p
      );
      setPrompts(updated);
      localStorage.setItem("ai_prompts", JSON.stringify(updated));
      setEditingKey(null);
      message.success("提示词保存成功");
    } catch (error) {
      if (error.errorFields) return;
      message.error("保存失败");
    }
  };

  const handleReset = () => {
    setPrompts(DEFAULT_PROMPTS);
    localStorage.removeItem("ai_prompts");
    setEditingKey(null);
    message.success("已重置为默认提示词");
  };

  const handleAdd = () => {
    const newKey = `custom_${Date.now()}`;
    const newPrompt = {
      key: newKey,
      name: "自定义提示词",
      description: "描述这个提示词的用途",
      prompt: "在这里输入您的提示词内容...",
    };
    const updated = [...prompts, newPrompt];
    setPrompts(updated);
    setEditingKey(newKey);
    form.setFieldsValue(newPrompt);
  };

  const handleDelete = (key) => {
    const updated = prompts.filter((p) => p.key !== key);
    setPrompts(updated);
    localStorage.setItem("ai_prompts", JSON.stringify(updated));
    setEditingKey(null);
    message.success("已删除");
  };

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThunderboltOutlined style={{ fontSize: 20, color: "#6366f1" }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>AI 提示词配置</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 13 }}>
                自定义 AI 分析时使用的提示词模板，优化分析效果
              </Text>
            </div>
          </div>
          <Space>
            <Button icon={<PlusOutlined />} onClick={handleAdd}>
              添加提示词
            </Button>
            <Button onClick={handleReset}>重置默认</Button>
          </Space>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 20 }}>
        {/* 提示词列表 */}
        <div style={{ width: 280 }}>
          {prompts.map((p) => (
            <Card
              key={p.key}
              size="small"
              hoverable
              onClick={() => handleEdit(p)}
              style={{
                marginBottom: 8,
                borderRadius: 12,
                cursor: "pointer",
                border: editingKey === p.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
                background: editingKey === p.key ? "#eef2ff" : "#ffffff",
              }}
              bodyStyle={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: 14 }}>{p.name}</Text>
                <Tag color="indigo" size="small">AI</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
                {p.description}
              </Text>
            </Card>
          ))}
        </div>

        {/* 编辑区 */}
        <div style={{ flex: 1 }}>
          {editingKey ? (
            <Card bordered={false} style={{ borderRadius: 16 }}>
              <Form form={form} layout="vertical">
                <Form.Item label="提示词名称" name="name">
                  <Input placeholder="例如：日志分析" />
                </Form.Item>
                <Form.Item label="描述" name="description">
                  <Input placeholder="简要描述这个提示词的用途" />
                </Form.Item>
                <Form.Item label="提示词内容" name="prompt">
                  <TextArea
                    rows={16}
                    placeholder="输入提示词内容，定义 AI 的角色、分析要求和输出格式..."
                    style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.8 }}
                  />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                      保存
                    </Button>
                    <Button onClick={() => setEditingKey(null)}>取消</Button>
                    {!DEFAULT_PROMPTS.find((d) => d.key === editingKey) && (
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(editingKey)}
                      >
                        删除
                      </Button>
                    )}
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          ) : (
            <Card bordered={false} style={{ borderRadius: 16 }}>
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <ThunderboltOutlined style={{ fontSize: 48, color: "#c7d2fe" }} />
                <Title level={4} style={{ color: "#94a3b8", marginTop: 16 }}>
                  选择一个提示词进行编辑
                </Title>
                <Text type="secondary">
                  点击左侧提示词卡片，或点击「添加提示词」创建新的提示词模板
                </Text>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
