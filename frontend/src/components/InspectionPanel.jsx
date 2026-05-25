import { useState } from "react";
import { Tabs } from "antd";
import {
  FileTextOutlined, PlayCircleOutlined, HistoryOutlined,
} from "@ant-design/icons";
import InspectionCommands from "./InspectionCommands";
import InspectionExecute from "./InspectionExecute";
import InspectionRecords from "./InspectionRecords";

const InspectionPanel = () => {
  const [activeTab, setActiveTab] = useState("commands");

  const items = [
    {
      key: "commands",
      label: (
        <span>
          <FileTextOutlined />
          巡检命令
        </span>
      ),
      children: <InspectionCommands />,
    },
    {
      key: "execute",
      label: (
        <span>
          <PlayCircleOutlined />
          巡检执行
        </span>
      ),
      children: (
        <InspectionExecute
          onExecuted={() => setActiveTab("records")}
        />
      ),
    },
    {
      key: "records",
      label: (
        <span>
          <HistoryOutlined />
          巡检记录
        </span>
      ),
      children: <InspectionRecords />,
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

export default InspectionPanel;
