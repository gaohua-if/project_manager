"use client";

import { api } from "@/lib/api";
import DirectorDashboard from "./DirectorDashboard";
import TLDashboard from "./TLDashboard";
import PMDashboard from "./PMDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

export default function DashboardPage() {
  const user = api.getUser();
  if (!user) return null;

  switch (user.role) {
    case "director":
      return <DirectorDashboard user={user} />;
    case "team_leader":
      return <TLDashboard user={user} />;
    case "pm":
      return <PMDashboard user={user} />;
    default:
      return <EmployeeDashboard user={user} />;
  }
}
