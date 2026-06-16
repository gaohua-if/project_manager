import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="请检查访问地址是否正确。"
      extra={
        <Button type="primary">
          <Link to="/">返回首页</Link>
        </Button>
      }
    />
  );
}
