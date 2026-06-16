"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const EMPLOYEE_ID_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ employee_id: "", name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!EMPLOYEE_ID_RE.test(form.employee_id)) {
      setError("工号只能包含字母、数字、下划线");
      return;
    }
    if (!form.name.trim()) {
      setError("请填写姓名");
      return;
    }
    if (!EMAIL_RE.test(form.email)) {
      setError("邮箱格式不正确");
      return;
    }
    if (form.password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (form.password !== form.confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      await api.register({
        employee_id: form.employee_id,
        name: form.name.trim(),
        email: form.email,
        password: form.password,
      });
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "注册失败");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-xl p-8 border border-border">
          <h1 className="text-2xl font-bold text-center mb-2">注册账号</h1>
          <p className="text-sm text-muted text-center mb-6">注册后默认为工程师，等待管理员分配团队</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="工号" value={form.employee_id} onChange={update("employee_id")} placeholder="字母 / 数字 / 下划线" />
            <Field label="姓名" value={form.name} onChange={update("name")} />
            <Field label="邮箱" value={form.email} onChange={update("email")} type="email" />
            <Field label="密码" value={form.password} onChange={update("password")} type="password" placeholder="至少 8 位" />
            <Field label="确认密码" value={form.confirm} onChange={update("confirm")} type="password" />

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {loading ? "注册中..." : "注册"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-muted">
            已有账号？
            <Link href="/login" className="ml-1 text-info hover:underline">
              登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
