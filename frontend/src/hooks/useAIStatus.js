import { useState, useEffect, useCallback } from "react";
import { aiAPI } from "../services/api";
import { message } from "antd";

export function useAIStatus() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const config = await aiAPI.getConfig();
      setAiConfig(config);
      const enabled = config && config.enabled && config.api_key;
      setAiEnabled(!!enabled);
    } catch (error) {
      setAiEnabled(false);
      setAiConfig(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const requireAI = useCallback(() => {
    if (!aiEnabled) {
      message.warning({
        content: "AI 服务未启用",
        description: "请先在「配置管理」中配置并启用 AI 服务",
      });
      return false;
    }
    return true;
  }, [aiEnabled]);

  return { aiEnabled, aiConfig, checking, checkStatus, requireAI };
}
