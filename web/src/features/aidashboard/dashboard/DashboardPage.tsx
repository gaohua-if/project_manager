import { useAuth } from "@/shared/auth/authContext";

import { DirectorDashboard } from "./DirectorDashboard";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { PMDashboard } from "./PMDashboard";
import { TLDashboard } from "./TLDashboard";

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case "admin":
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
