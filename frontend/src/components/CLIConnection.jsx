import { useState, useEffect, useRef } from "react";
import { Modal, message, Tooltip, Button } from "antd";
import { DisconnectOutlined, ReloadOutlined } from "@ant-design/icons";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

const CLIConnection = ({ visible, onClose, device }) => {
  const terminalRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termRef = useRef(null);
  const wsReadyRef = useRef(false);
  const inputBufferRef = useRef("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // 断开连接
  const disconnect = () => {
    wsReadyRef.current = false;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    setConnected(false);
  };

  // 连接 WebSocket + 初始化终端
  const connect = () => {
    if (!device || !terminalRef.current) return;

    // 清理旧终端
    if (termRef.current) {
      try { termRef.current.dispose(); } catch (e) {}
      termRef.current = null;
    }
    if (fitAddonRef.current) {
      fitAddonRef.current = null;
    }
    disconnect();

    // 创建 xterm 终端
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
        black: "#1e1e1e",
        green: "#4ec9b0",
        cyan: "#9cdcfe",
        yellow: "#dcdcaa",
        red: "#f44747",
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    inputBufferRef.current = "";

    // 终端输入 → 发送到 WebSocket
    term.onData((data) => {
      if (!wsReadyRef.current || !wsRef.current) return;
      const code = data.charCodeAt(0);
      if (code === 13) {
        // Enter
        const cmd = inputBufferRef.current;
        wsRef.current.send(JSON.stringify({ command: cmd }));
        term.write("\r\n");
        inputBufferRef.current = "";
      } else if (code === 127 || code === 8) {
        // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (code >= 32 && code < 127) {
        // 可打印字符
        inputBufferRef.current += data;
        term.write(data);
      } else if (code === 3) {
        // Ctrl+C
        wsRef.current.send(JSON.stringify({ command: "\x03" }));
        term.write("^C\r\n");
      } else if (code === 4) {
        // Ctrl+D
        wsRef.current.send(JSON.stringify({ command: "\x04" }));
      } else if (code === 26) {
        // Ctrl+Z
        wsRef.current.send(JSON.stringify({ command: "\x1a" }));
      } else if (code === 9) {
        // Tab
        wsRef.current.send(JSON.stringify({ command: inputBufferRef.current + "\t" }));
      }
    });

    // 终端大小变化 → 通知后端
    term.onResize(({ cols, rows }) => {
      if (wsReadyRef.current && wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    // 连接 WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/cli/${device.id}`;

    setConnecting(true);
    term.write(`\x1b[36m正在连接到 ${device.name} (${device.ip_address}:${device.port})...\x1b[0m\r\n`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    wsReadyRef.current = false;

    ws.onopen = () => {
      setConnecting(false);
      setConnected(true);
      wsReadyRef.current = true;
      // 同步终端大小
      const { cols, rows } = term;
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "connected":
            term.write(`\x1b[32m${msg.message}\x1b[0m\r\n`);
            break;
          case "output":
            if (msg.data) {
              term.write(msg.data);
            }
            break;
          case "error":
            term.write(`\x1b[31m[错误] ${msg.message}\x1b[0m\r\n`);
            message.error(msg.message);
            break;
          case "info":
            term.write(`\x1b[33m[信息] ${msg.message}\x1b[0m\r\n`);
            break;
          case "disconnected":
            term.write(`\x1b[33m[会话已断开]\x1b[0m\r\n`);
            setConnected(false);
            wsReadyRef.current = false;
            break;
          default:
            break;
        }
      } catch (e) {
        // 忽略非 JSON 数据
      }
    };

    ws.onerror = () => {
      term.write("\x1b[31m[错误] WebSocket 连接失败\x1b[0m\r\n");
      setConnecting(false);
      setConnected(false);
      wsReadyRef.current = false;
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      wsReadyRef.current = false;
      if (termRef.current) {
        term.write("\r\n\x1b[33m[会话已断开]\x1b[0m\r\n");
      }
    };
  };

  // 打开弹窗时连接
  useEffect(() => {
    if (visible && device) {
      // 延迟一帧确保 DOM 已渲染
      const timer = setTimeout(() => connect(), 50);
      return () => {
        clearTimeout(timer);
        disconnect();
        if (termRef.current) {
          try { termRef.current.dispose(); } catch (e) {}
          termRef.current = null;
        }
        fitAddonRef.current = null;
      };
    }
  }, [visible, device?.id]);

  // 窗口大小变化时自适应
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 关闭弹窗
  const handleClose = () => {
    disconnect();
    if (termRef.current) {
      try { termRef.current.dispose(); } catch (e) {}
      termRef.current = null;
    }
    fitAddonRef.current = null;
    onClose();
  };

  // 重新连接
  const handleReconnect = () => {
    disconnect();
    if (termRef.current) {
      try { termRef.current.dispose(); } catch (e) {}
      termRef.current = null;
    }
    setTimeout(() => connect(), 100);
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>CLI — {device?.name || ""}</span>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
            {device?.ip_address}:{device?.port} · {device?.protocol?.toUpperCase()}
          </span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "#52c41a" : connecting ? "#faad14" : "#f5222d",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {connected ? "已连接" : connecting ? "连接中..." : "未连接"}
          </span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Tooltip title="重新连接">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleReconnect}
                disabled={connecting}
                style={{ marginRight: 8 }}
              >
                重连
              </Button>
            </Tooltip>
            <Tooltip title="断开连接">
              <Button
                danger
                icon={<DisconnectOutlined />}
                onClick={disconnect}
                disabled={!connected}
              >
                断开
              </Button>
            </Tooltip>
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Enter 发送 · Ctrl+C 中断 · Tab 补全 · 支持方向键/历史命令
          </span>
        </div>
      }
      width={1000}
      bodyStyle={{ padding: 0, background: "#1e1e1e" }}
      style={{ top: 20 }}
      destroyOnClose
    >
      <div
        ref={terminalRef}
        style={{
          width: "100%",
          height: "600px",
          background: "#1e1e1e",
        }}
      />
    </Modal>
  );
};

export default CLIConnection;
