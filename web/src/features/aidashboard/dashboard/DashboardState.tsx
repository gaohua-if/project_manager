import { Alert, Button, Space } from "antd";

interface QueryStateLike {
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

export function DashboardErrorAlert({
  items
}: {
  items: Array<{ label: string; query: QueryStateLike }>;
}) {
  const failed = items.filter((item) => item.query.isError);
  if (failed.length === 0) return null;

  return (
    <Alert
      type="error"
      showIcon
      message="部分数据加载失败"
      description={failed
        .map((item) => `${item.label}: ${getErrorMessage(item.query.error)}`)
        .join("；")}
      action={
        <Space>
          {failed.map((item) => (
            <Button key={item.label} size="small" onClick={() => void item.query.refetch()}>
              重试{item.label}
            </Button>
          ))}
        </Space>
      }
    />
  );
}
