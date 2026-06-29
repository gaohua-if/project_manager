import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Spin } from "antd";
import { useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

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
  const fromLocation = (location.state as { from?: { pathname?: string; search?: string } } | null)
    ?.from;
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
            <p>使用 AIHub 账号登录</p>
          </div>

          {from !== "/" ? <div className="login-page__return-tip">登录后返回：{from}</div> : null}

          <Form
            layout="vertical"
            requiredMark={false}
            onValuesChange={() => setLoginError(null)}
            onFinish={async (values: { username: string; password: string }) => {
              setSubmitting(true);
              setLoginError(null);
              try {
                await login({
                  username: values.username.trim(),
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
            <Form.Item
              label="账号"
              name="username"
              rules={[{ required: true, message: "请输入 AIHub 账号" }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="username" placeholder="AIHub 用户名" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                autoComplete="current-password"
                placeholder="请输入密码"
              />
            </Form.Item>
            {loginError ? (
              <Alert type="error" showIcon message={loginError} className="login-page__error" />
            ) : null}
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form>

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
