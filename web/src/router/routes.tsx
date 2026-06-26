import {
  BarChartOutlined,
  BellOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ProjectOutlined,
  SolutionOutlined,
  TeamOutlined
} from "@ant-design/icons";

import { DashboardPage } from "@/features/aidashboard/dashboard/DashboardPage";
import { OrganizationPage } from "@/features/aidashboard/organization/pages/OrganizationPage";
import { OrganizationPasswordResetPage } from "@/features/aidashboard/organization/pages/OrganizationPasswordResetPage";
import { OrganizationUserEditPage } from "@/features/aidashboard/organization/pages/OrganizationUserEditPage";
import { ProductDocumentCreatePage } from "@/features/aidashboard/products/pages/ProductDocumentCreatePage";
import { ProductsPage } from "@/features/aidashboard/products/pages/ProductsPage";
import {
  DailyReportsPage,
  DepartmentDailyReportDetailPage,
  PersonalDailyReportDetailPage,
  ReportsPage,
  TeamDailyReportDetailPage
} from "@/features/aidashboard/reports/pages/ReportsPage";
import { WeeklyReportsPage } from "@/features/aidashboard/reports/pages/WeeklyReportsPage";
import { RequirementCreatePage } from "@/features/aidashboard/requirements/pages/RequirementCreatePage";
import { RequirementDetailPage } from "@/features/aidashboard/requirements/pages/RequirementDetailPage";
import { RequirementsListPage } from "@/features/aidashboard/requirements/pages/RequirementsListPage";
import { SessionsPage } from "@/features/aidashboard/sessions/pages/SessionsPage";
import { TaskCreatePage } from "@/features/aidashboard/tasks/pages/TaskCreatePage";
import { TaskDetailPage } from "@/features/aidashboard/tasks/pages/TaskDetailPage";
import { TasksListPage } from "@/features/aidashboard/tasks/pages/TasksListPage";
import { TokensPage } from "@/features/aidashboard/tokens/pages/TokensPage";

import { PagePlaceholder } from "./PagePlaceholder";
import type { AppRoute } from "./types";

export const appRoutes: AppRoute[] = [
  {
    path: "/dashboard",
    title: "控制台",
    icon: <DashboardOutlined />,
    menuGroup: "概览",
    menuOrder: 10,
    element: <DashboardPage />
  },
  {
    path: "/organization",
    title: "组织 / 用户管理",
    icon: <TeamOutlined />,
    menuGroup: "管理",
    menuOrder: 20,
    roles: ["admin", "director", "pm", "team_leader"],
    element: <OrganizationPage />
  },
  {
    path: "/organization/users/:id/edit",
    title: "编辑成员",
    hideInMenu: true,
    roles: ["admin"],
    element: <OrganizationUserEditPage />
  },
  {
    path: "/organization/users/:id/reset-password",
    title: "重置密码",
    hideInMenu: true,
    roles: ["admin"],
    element: <OrganizationPasswordResetPage />
  },
  {
    path: "/requirements",
    title: "需求推进",
    icon: <ProjectOutlined />,
    menuGroup: "业务",
    menuOrder: 30,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <RequirementsListPage />
  },
  {
    path: "/requirements/create",
    title: "新建需求",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader"],
    element: <RequirementCreatePage />
  },
  {
    path: "/requirements/:id",
    title: "需求详情",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <RequirementDetailPage />
  },
  {
    path: "/tasks",
    title: "任务",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <TasksListPage />
  },
  {
    path: "/tasks/create",
    title: "创建任务",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <TaskCreatePage />
  },
  {
    path: "/tasks/:id",
    title: "任务详情",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <TaskDetailPage />
  },
  {
    path: "/products",
    title: "我的工作",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <ProductsPage />
  },
  {
    path: "/products/documents/create",
    title: "添加文档",
    hideInMenu: true,
    roles: ["admin", "director", "pm", "team_leader", "employee"],
    element: <ProductDocumentCreatePage />
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
    title: "日报",
    hideInMenu: true,
    element: <ReportsPage />
  },
  {
    path: "/reports/daily",
    title: "日报",
    icon: <FileTextOutlined />,
    menuGroup: "报告",
    menuOrder: 70,
    element: <DailyReportsPage />
  },
  {
    path: "/reports/daily/personal/:id",
    title: "个人日报详情",
    hideInMenu: true,
    element: <PersonalDailyReportDetailPage />
  },
  {
    path: "/reports/daily/team/:id",
    title: "小组日报详情",
    hideInMenu: true,
    element: <TeamDailyReportDetailPage />
  },
  {
    path: "/reports/daily/department/:id",
    title: "部门日报详情",
    hideInMenu: true,
    element: <DepartmentDailyReportDetailPage />
  },
  {
    path: "/reports/weekly",
    title: "周报",
    icon: <FileTextOutlined />,
    menuGroup: "报告",
    menuOrder: 71,
    roles: ["admin", "director", "team_leader"],
    element: <WeeklyReportsPage />
  },
  {
    path: "/tokens",
    title: "Token 明细",
    icon: <BarChartOutlined />,
    menuGroup: "系统",
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
