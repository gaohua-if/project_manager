import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="暂无访问权限"
      subTitle="当前账号没有访问该页面的权限。"
      extra={
        <Button type="primary">
          <Link to="/">返回首页</Link>
        </Button>
      }
    />
  );
}
