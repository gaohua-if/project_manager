import { Segmented } from "antd";
import { useEffect, useMemo, useState } from "react";
import { UserOutlined } from "@ant-design/icons";

import { useAuth } from "@/shared/auth/authContext";

import { DirectorDashboard } from "./DirectorDashboard";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { PMDashboard } from "./PMDashboard";
import { TLDashboard } from "./TLDashboard";
import "./role-homepage.css";

type PreviewRole = "employee" | "team_leader" | "director" | "pm";

const ROLE_OPTIONS: { label: string; value: PreviewRole }[] = [
  { label: "员工", value: "employee" },
  { label: "TL", value: "team_leader" },
  { label: "总监", value: "director" },
  { label: "PM", value: "pm" }
];

export function DashboardPage() {
  const { user } = useAuth();
  const defaultRole = useMemo<PreviewRole>(() => {
    if (user?.role === "director" || user?.role === "admin") return "director";
    if (user?.role === "pm") return "pm";
    if (user?.role === "team_leader") return "team_leader";
    return "employee";
  }, [user?.role]);
  const [previewRole, setPreviewRole] = useState<PreviewRole>(defaultRole);

  useEffect(() => {
    setPreviewRole(defaultRole);
  }, [defaultRole]);

  if (!user) return null;

  return (
    <>
      <div className="role-home-debug">
        <span className="role-home-debug__label">
          <UserOutlined />
          角色预览
        </span>
        <Segmented
          size="small"
          options={ROLE_OPTIONS}
          value={previewRole}
          onChange={(value) => setPreviewRole(value as PreviewRole)}
        />
      </div>
      {renderDashboard(previewRole)}
    </>
  );
}

function renderDashboard(role: PreviewRole) {
  switch (role) {
    case "director":
      return <DirectorDashboard />;
    case "pm":
      return <PMDashboard />;
    case "team_leader":
      return <TLDashboard />;
    default:
      return <EmployeeDashboard />;
  }
}
