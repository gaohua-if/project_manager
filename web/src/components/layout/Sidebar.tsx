"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useEffect, useState } from "react";

const NAV_ITEMS: Record<string, Array<{ label: string; href: string; roles: string[] }>> = {
  director: [
    { label: "Dashboard", href: "/dashboard", roles: ["director"] },
    { label: "Organization", href: "/organization", roles: ["director", "pm", "team_leader"] },
    { label: "Requirements", href: "/requirements", roles: ["director", "pm", "team_leader"] },
    { label: "Tasks", href: "/tasks", roles: ["director", "team_leader", "employee"] },
    { label: "Products", href: "/products", roles: ["director", "team_leader", "employee"] },
    { label: "Reports", href: "/reports", roles: ["director", "team_leader", "employee", "pm"] },
  ],
  pm: [
    { label: "Dashboard", href: "/dashboard", roles: ["pm"] },
    { label: "Organization", href: "/organization", roles: ["director", "pm", "team_leader"] },
    { label: "Requirements", href: "/requirements", roles: ["director", "pm", "team_leader"] },
    { label: "Tasks", href: "/tasks", roles: ["director", "team_leader", "employee"] },
    { label: "Products", href: "/products", roles: ["director", "team_leader", "employee"] },
    { label: "Reports", href: "/reports", roles: ["director", "team_leader", "employee", "pm"] },
  ],
  team_leader: [
    { label: "Dashboard", href: "/dashboard", roles: ["team_leader"] },
    { label: "Organization", href: "/organization", roles: ["director", "pm", "team_leader"] },
    { label: "Requirements", href: "/requirements", roles: ["director", "pm", "team_leader"] },
    { label: "Tasks", href: "/tasks", roles: ["director", "team_leader", "employee"] },
    { label: "Products", href: "/products", roles: ["director", "team_leader", "employee"] },
    { label: "Reports", href: "/reports", roles: ["director", "team_leader", "employee", "pm"] },
  ],
  employee: [
    { label: "Dashboard", href: "/dashboard", roles: ["employee"] },
    { label: "Tasks", href: "/tasks", roles: ["director", "team_leader", "employee"] },
    { label: "Products", href: "/products", roles: ["director", "team_leader", "employee"] },
    { label: "Reports", href: "/reports", roles: ["director", "team_leader", "employee", "pm"] },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUser(api.getUser());
  }, []);

  if (!user) return null;

  const items = NAV_ITEMS[user.role] || NAV_ITEMS.employee;

  return (
    <aside className="w-56 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">AIDashboard</h1>
        <p className="text-xs text-muted mt-1">
          {user.name} &middot; {roleLabel(user.role)}
        </p>
      </div>
      <nav className="flex-1 p-2">
        {items
          .filter((item) => item.roles.includes(user.role))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-border hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
      </nav>
      <div className="p-4 border-t border-border">
        <button
          onClick={() => {
            const token = localStorage.getItem("token");
            if (token) {
              navigator.clipboard.writeText(token);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="text-sm text-dim hover:text-info transition-colors block mb-2"
        >
          {copied ? "Copied!" : "Copy Token"}
        </button>
        <button
          onClick={() => {
            api.clearToken();
            router.push("/login");
          }}
          className="text-sm text-dim hover:text-danger transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    director: "Director",
    pm: "PM",
    team_leader: "TL",
    employee: "Employee",
  };
  return labels[role] || role;
}
