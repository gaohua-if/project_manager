import {
  AppstoreOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Spin, Tag } from "antd";
import { useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { runtimeConfig } from "@/config/runtimeConfig";
import { useAuth } from "@/shared/auth/authContext";

import "./LoginPage.css";

const platformCapabilities = [
  { icon: <SafetyCertificateOutlined />, label: "真实认证" },
  { icon: <DatabaseOutlined />, label: "业务数据" },
  { icon: <DashboardOutlined />, label: "运营分析" },
  { icon: <AppstoreOutlined />, label: "统一体验" }
];

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
        <div className="login-page__intro">
          <Tag color="blue" className="login-page__eyebrow">
            AIHub Platform
          </Tag>
          <div className="login-page__brand">
            <span className="login-page__brand-mark" aria-hidden="true">
              AI
            </span>
            <div>
              <h1 id="login-title">{runtimeConfig.appTitle}</h1>
              <p>统一访问业务工作台、安全会话与平台数据。</p>
            </div>
          </div>
          <div className="login-page__capabilities" aria-label="平台能力">
            {platformCapabilities.map((item) => (
              <div className="login-page__capability" key={item.label}>
                <span className="login-page__capability-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="login-page__preview" aria-label="平台状态摘要">
            <div>
              <span className="login-page__preview-label">认证状态</span>
              <strong>真实账号认证</strong>
            </div>
            <div>
              <span className="login-page__preview-label">会话状态</span>
              <strong>安全恢复</strong>
            </div>
            <div>
              <span className="login-page__preview-label">设计系统</span>
              <strong>AntD 6 + AIHub tokens</strong>
            </div>
          </div>
        </div>

        <Card className="login-page__card">
          <div className="login-page__title">
            <Tag color="success">Secure Login</Tag>
            <h2>登录到工作台</h2>
            <p>使用平台账号登录，认证成功后会进入你原本访问的页面。</p>
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
            <Form.Item label="账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
              <Input prefix={<UserOutlined />} autoComplete="username" placeholder="请输入账号" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            {loginError ? <Alert type="error" showIcon message={loginError} className="login-page__error" /> : null}
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
