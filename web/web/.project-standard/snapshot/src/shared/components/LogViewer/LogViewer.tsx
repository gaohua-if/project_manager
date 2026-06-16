import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { App, Button, Space } from "antd";

import "./LogViewer.css";

interface LogViewerProps {
  title?: string;
  value: string;
  fileName?: string;
  height?: number;
}

export function LogViewer({
  title = "运行日志",
  value,
  fileName = "aihub-log.txt",
  height = 300
}: LogViewerProps) {
  const { message } = App.useApp();

  const copyLog = async () => {
    await navigator.clipboard.writeText(value);
    message.success("日志已复制");
  };

  const downloadLog = () => {
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="log-viewer">
      <div className="log-viewer__toolbar">
        <div className="log-viewer__title">{title}</div>
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={copyLog}>
            复制
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={downloadLog}>
            下载
          </Button>
        </Space>
      </div>
      <pre className="log-viewer__body" style={{ height }}>
        {value}
      </pre>
    </section>
  );
}
