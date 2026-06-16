import { Alert, Button, Card, Form, Input } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerUser } from "@/shared/auth/authApi";
import { setAuthSession } from "@/shared/auth/session";
import { runtimeConfig } from "@/config/runtimeConfig";

import "./LoginPage.css";

const EMPLOYEE_ID_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="login-page">
      <section className="login-page__shell">
        <Card className="login-page__card">
          <div className="login-page__title">
            <h2>注册 {runtimeConfig.appTitle} 账号</h2>
            <p>注册后默认为工程师，等待管理员分配团队</p>
          </div>

          <Form
            layout="vertical"
            requiredMark={false}
            onValuesChange={() => setError(null)}
            onFinish={async (values: {
              employee_id: string;
              name: string;
              email: string;
              password: string;
              confirm: string;
            }) => {
              const employeeId = values.employee_id.trim();
              const name = values.name.trim();
              const email = values.email.trim();

              if (!EMPLOYEE_ID_RE.test(employeeId)) {
                setError("工号只能包含字母、数字、下划线");
                return;
              }
              if (!name) {
                setError("请填写姓名");
                return;
              }
              if (!EMAIL_RE.test(email)) {
                setError("邮箱格式不正确");
                return;
              }
              if (values.password.length < 8) {
                setError("密码至少 8 位");
                return;
              }
              if (values.password !== values.confirm) {
                setError("两次输入的密码不一致");
                return;
              }

              setSubmitting(true);
              try {
                const { token } = await registerUser({
                  employee_id: employeeId,
                  name,
                  email,
                  password: values.password
                });
                setAuthSession({ token });
                navigate("/login", { replace: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : "注册失败");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Form.Item
              label="工号"
              name="employee_id"
              rules={[{ required: true, message: "请输入工号" }]}
              extra="登录时使用，仅允许字母 / 数字 / 下划线"
            >
              <Input autoComplete="off" placeholder="如 zhangsan" />
            </Form.Item>
            <Form.Item label="姓名" name="name" rules={[{ required: true, message: "请输入姓名" }]}>
              <Input autoComplete="name" />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, message: "请输入邮箱" }]}
            >
              <Input autoComplete="email" type="email" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
              extra="至少 8 位"
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              label="确认密码"
              name="confirm"
              rules={[{ required: true, message: "请再次输入密码" }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>

            {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}

            <Button type="primary" htmlType="submit" block loading={submitting}>
              注册
            </Button>
          </Form>

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 13 }}>
            已有账号？
            <Link to="/login">登录</Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
