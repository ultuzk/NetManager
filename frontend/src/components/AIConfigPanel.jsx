import { useState } from "react";
import { Tabs } from "antd";
import {
  ThunderboltOutlined, MessageOutlined, SettingOutlined, FileTextOutlined,
} from "@ant-design/icons";
import AILogAnalysis from "./AILogAnalysis";
import AIChat from "./AIChat";
import AIConfig from "./AIConfig";
import AIPrompts from "./AIPrompts";

const AIConfigPanel = () => {
  const [activeTab, setActiveTab] = useState("analysis");

  const items = [
    {
      key: "analysis",
      label: (
        <span>
          <FileTextOutlined />
          日志分析
        </span>
      ),
      children: <AILogAnalysis />,
    },
    {
      key: "chat",
      label: (
        <span>
          <MessageOutlined />
          AI 对话
        </span>
      ),
      children: <AIChat />,
    },
    {
      key: "config",
      label: (
        <span>
          <SettingOutlined />
          配置管理
        </span>
      ),
      children: <AIConfig />,
    },
    {
      key: "prompts",
      label: (
        <span>
          <ThunderboltOutlined />
          提示词配置
        </span>
      ),
      children: <AIPrompts />,
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        size="large"
      />
    </div>
  );
};

export default AIConfigPanel;
