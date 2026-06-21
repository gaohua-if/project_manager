import { Result } from "antd";

export function PagePlaceholder({ title }: { title: string }) {
  return <Result status="info" title={title} subTitle="该模块将在后续迁移轮次中接入业务逻辑。" />;
}
