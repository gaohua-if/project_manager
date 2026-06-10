"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Array<{ name: string; role: string }>>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1"}/users`)
      .then(() => {
        setUsers([
          { name: "李总监", role: "director" },
          { name: "陈PM", role: "pm" },
          { name: "刘TL", role: "team_leader" },
          { name: "赵TL", role: "team_leader" },
          { name: "孙TL", role: "team_leader" },
          { name: "张三", role: "employee" },
          { name: "李四", role: "employee" },
          { name: "王五", role: "employee" },
          { name: "赵六", role: "employee" },
          { name: "钱七", role: "employee" },
        ]);
      })
      .catch(() => setError("Cannot connect to API server"));
  }, []);

  const handleLogin = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      await api.login(selected);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-xl p-8 border border-border">
          <h1 className="text-2xl font-bold text-center mb-2">AIDashboard</h1>
          <p className="text-sm text-muted text-center mb-6">Select user to login</p>

          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Select User --</option>
            {users.map((u) => (
              <option key={u.name} value={u.name}>
                {u.name} ({roleLabel(u.role)})
              </option>
            ))}
          </select>

          {error && <p className="text-sm text-danger mb-4">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={!selected || loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    director: "Director",
    pm: "PM",
    team_leader: "TL",
    employee: "Engineer",
  };
  return labels[role] || role;
}
