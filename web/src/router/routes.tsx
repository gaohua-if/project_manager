import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ProjectOutlined,
  SolutionOutlined,
  TeamOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { Result } from "antd";

import { DashboardPage } from "@/features/aidashboard/dashboard/DashboardPage";
import { OrganizationPage } from "@/features/aidashboard/organization/pages/OrganizationPage";
import { ProductsPage } from "@/features/aidashboard/products/pages/ProductsPage";
import { ReportsPage } from "@/features/aidashboard/reports/pages/ReportsPage";
import { RequirementDetailPage } from "@/features/aidashboard/requirements/pages/RequirementDetailPage";
import { RequirementsListPage } from "@/features/aidashboard/requirements/pages/RequirementsListPage";
import { SessionsPage } from "@/features/aidashboard/sessions/pages/SessionsPage";
import { TaskDetailPage } from "@/features/aidashboard/tasks/pages/TaskDetailPage";
import { TasksListPage } from "@/features/aidashboard/tasks/pages/TasksListPage";
import { TokensPage } from "@/features/aidashboard/tokens/pages/TokensPage";

import type { AppRoute } from "./types";

function PagePlaceholder({ title }: { title: string }) {
  return (
    <Result
      status="info"
      title={title}
      subTitle="该模块将在后续迁移轮次中接入业务逻辑。"
    />
  );
}

export const appRoutes: AppRoute[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    icon: <DashboardOutlined />,
    menuGroup: "概览",
    menuOrder: 10,
    element: <DashboardPage />
  },
  {
    path: "/organization",
    title: "组织",
    icon: <TeamOutlined />,
    menuGroup: "概览",
    menuOrder: 20,
    roles: ["admin", "director", "pm", "team_leader"],
    element: <OrganizationPage />
  },
  {
    path: "/requirements",
    title: "需求",
    icon: <ProjectOutlined />,
    menuGroup: "业务",
    menuOrder: 30,
    roles: ["admin", "director", "pm", "team_leader"],
    element: <RequirementsListPage />
  },
  {
    path: "/requirements/:id",
    title: "需求详情",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader"],
    element: <RequirementDetailPage />
  },
  {
    path: "/tasks",
    title: "任务",
    icon: <UnorderedListOutlined />,
    menuGroup: "业务",
    menuOrder: 40,
    roles: ["admin", "director", "team_leader", "employee"],
    element: <TasksListPage />
  },
  {
    path: "/tasks/:id",
    title: "任务详情",
    hideInMenu: true,
    roles: ["admin", "director", "team_leader", "employee"],
    element: <TaskDetailPage />
  },
  {
    path: "/products",
    title: "我的工作",
    icon: <AppstoreOutlined />,
    menuGroup: "业务",
    menuOrder: 50,
    roles: ["admin", "director", "team_leader", "employee"],
    element: <ProductsPage />
  },
  {
    path: "/sessions",
    title: "AI 工作记录",
    icon: <SolutionOutlined />,
    menuGroup: "业务",
    menuOrder: 60,
    hideInMenu: true,
    element: <SessionsPage />
  },
  {
    path: "/reports",
    title: "报告",
    icon: <FileTextOutlined />,
    menuGroup: "报告",
    menuOrder: 70,
    element: <ReportsPage />
  },
  {
    path: "/tokens",
    title: "Token 明细",
    icon: <BarChartOutlined />,
    menuGroup: "报告",
    menuOrder: 80,
    element: <TokensPage />
  },
  {
    path: "/notifications",
    title: "空闲告警",
    icon: <BellOutlined />,
    hideInMenu: true,
    element: <PagePlaceholder title="空闲告警" />
  }
];
