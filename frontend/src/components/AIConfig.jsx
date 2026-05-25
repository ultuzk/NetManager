import { useState, useEffect } from "react";
import {
  Form, Input, Select, Button, message, Space, Alert, Card, Typography, Switch, Divider,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, SaveOutlined, ApiOutlined,
} from "@ant-design/icons";
import { aiAPI } from "../services/api";

const { Option } = Select;
const { Text } = Typography;

export default function AIConfig({ onConfigChange }) {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [form] = Form.useForm();

  const fetchConfig = async () => {
    try {
      const data = await aiAPI.getConfig();
      if (data) {
        setConfig(data);
        form.setFieldsValue(data);
      }
    } catch (error) {
      // 静默
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const result = await aiAPI.updateConfig(values);
      if (result) {
        message.success("配置保存成功");
        setConfig(values);
        onConfigChange?.(values);
      }
    } catch (error) {
      if (error.errorFields) return;
      message.error("保存失败");
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const result = await aiAPI.testConnection();
      setTestResult(result);
      if (result.success) {
        message.success("连接测试成功");
      } else {
        message.error(result.message || "连接测试失败");
      }
    } catch (error) {
      setTestResult({ success: false, message: "测试失败" });
      message.error("测试失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ApiOutlined style={{ fontSize: 20, color: "#6366f1" }} />
          <div>
            <Text strong style={{ fontSize: 16 }}>AI 服务配置</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              配置 AI 服务提供商、API 密钥和模型参数
            </Text>
          </div>
        </div>
      </Card>

      <Card bordered={false}>
        <Form form={form} layout="vertical" initialValues={{
          provider: "openai",
          model: "gpt-4",
          base_url: "https://api.openai.com/v1",
          timeout: 30,
          enabled: false,
        }}>
          <Form.Item label="服务提供商" name="provider">
            <Select placeholder="选择 AI 服务提供商">
              <Option value="openai">OpenAI</Option>
              <Option value="azure">Azure OpenAI</Option>
              <Option value="anthropic">Anthropic (Claude)</Option>
              <Option value="deepseek">DeepSeek</Option>
              <Option value="custom">自定义 API</Option>
            </Select>
          </Form.Item>

          <Form.Item label="API 密钥" name="api_key">
            <Input.Password placeholder="sk-..." visibilityToggle />
          </Form.Item>

          <Form.Item label="API 基础 URL" name="base_url">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item label="模型名称" name="model">
            <Input placeholder="gpt-4 / claude-3 / deepseek-chat ..." />
          </Form.Item>

          <Form.Item label="超时时间（秒）" name="timeout">
            <Input type="number" min={5} max={300} />
          </Form.Item>

          <Divider />

          <Form.Item label="启用 AI 服务" name="enabled" valuePropName="checked">
            <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存配置
              </Button>
              <Button icon={<CheckCircleOutlined />} onClick={handleTest} loading={loading}>
                测试连接
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {testResult && (
          <Alert
            message={testResult.success ? "连接测试成功" : "连接测试失败"}
            description={testResult.message}
            type={testResult.success ? "success" : "error"}
            showIcon
            icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    </div>
  );
}
