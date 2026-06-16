import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Spin } from "antd";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { runtimeConfig } from "@/config/runtimeConfig";
import { useAuth } from "@/shared/auth/authContext";

import "./LoginPage.css";

function resolveSafeReturnPath(candidate: string | null | undefined) {
  if (!candidate?.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/login")) {
    return "/";
  }
  return candidate;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { status, isAuthenticated, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const fromLocation = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const requestedPath = fromLocation
    ? `${fromLocation.pathname ?? "/"}${fromLocation.search ?? ""}`
    : searchParams.get("next");
  const from = resolveSafeReturnPath(requestedPath);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="login-page">
      <section className="login-page__shell" aria-labelledby="login-title">
        <Card className="login-page__card">
          <div className="login-page__title">
            <h2>{runtimeConfig.appTitle}</h2>
            <p>使用工号登录</p>
          </div>

          {from !== "/" ? <div className="login-page__return-tip">登录后返回：{from}</div> : null}

          <Form
            layout="vertical"
            requiredMark={false}
            onValuesChange={() => setLoginError(null)}
            onFinish={async (values: { employee_id: string; password: string }) => {
              setSubmitting(true);
              setLoginError(null);
              try {
                await login({
                  employee_id: values.employee_id.trim(),
                  password: values.password
                });
                navigate(from, { replace: true });
              } catch (error) {
                setLoginError(error instanceof Error ? error.message : "登录失败，请稍后重试");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Form.Item label="工号" name="employee_id" rules={[{ required: true, message: "请输入工号" }]}>
              <Input prefix={<UserOutlined />} autoComplete="username" placeholder="如 admin" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            {loginError ? <Alert type="error" showIcon message={loginError} className="login-page__error" /> : null}
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form>

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 13 }}>
            没有账号？
            <Link to="/register">注册</Link>
          </div>

          {status === "initializing" && !submitting ? (
            <div className="login-page__session-loading">
              <Spin size="small" />
              <span>正在恢复登录状态...</span>
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
