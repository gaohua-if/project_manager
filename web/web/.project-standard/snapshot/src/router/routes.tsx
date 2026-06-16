import { AppstoreOutlined, DashboardOutlined, DatabaseOutlined } from "@ant-design/icons";

import { ComponentGalleryPage } from "@/features/component-gallery/pages/ComponentGalleryPage";
import { DashboardExamplePage } from "@/features/dashboard-example";
import { ModuleCrudDetailPage } from "@/features/module-crud/pages/ModuleCrudDetailPage";
import { ModuleCrudFormPage } from "@/features/module-crud/pages/ModuleCrudFormPage";
import { ModuleCrudListPage } from "@/features/module-crud/pages/ModuleCrudListPage";
import { TableCrudDetailPage } from "@/features/table-crud/pages/TableCrudDetailPage";
import { TableCrudFormPage } from "@/features/table-crud/pages/TableCrudFormPage";
import { TableCrudListPage } from "@/features/table-crud/pages/TableCrudListPage";

import type { AppRoute } from "./types";

export const appRoutes: AppRoute[] = [
  {
    path: "/component-gallery",
    title: "Components",
    icon: <AppstoreOutlined />,
    menuGroup: "Build",
    permission: "component_gallery",
    access: "component_gallery",
    authName: "component_gallery",
    element: <ComponentGalleryPage />
  },
  {
    path: "/examples/table-crud",
    title: "Table CRUD",
    icon: <DatabaseOutlined />,
    menuGroup: "Data",
    element: <TableCrudListPage />
  },
  {
    path: "/examples/dashboard",
    title: "Dashboard",
    icon: <DashboardOutlined />,
    menuGroup: "Overview",
    element: <DashboardExamplePage />
  },
  {
    path: "/examples/table-crud/create/simple",
    title: "新建 Table 资源 - 简单表单",
    hideInMenu: true,
    element: <TableCrudFormPage variant="simple" />
  },
  {
    path: "/examples/table-crud/create/steps",
    title: "新建 Table 资源 - 分步骤表单",
    hideInMenu: true,
    element: <TableCrudFormPage variant="steps" />
  },
  {
    path: "/examples/table-crud/create/advanced",
    title: "新建 Table 资源 - 大型表单",
    hideInMenu: true,
    element: <TableCrudFormPage variant="advanced" />
  },
  {
    path: "/examples/table-crud/create",
    title: "新建 Table 资源",
    hideInMenu: true,
    element: <TableCrudFormPage variant="standard" />
  },
  {
    path: "/examples/table-crud/:id/edit",
    title: "编辑 Table 资源",
    hideInMenu: true,
    element: <TableCrudFormPage variant="standard" />
  },
  {
    path: "/examples/table-crud/:id",
    title: "Table 资源详情",
    hideInMenu: true,
    element: <TableCrudDetailPage />
  },
  {
    path: "/examples/module-crud",
    title: "Module CRUD",
    icon: <AppstoreOutlined />,
    menuGroup: "Data",
    element: <ModuleCrudListPage />
  },
  {
    path: "/examples/module-crud/:id/edit",
    title: "编辑模块",
    hideInMenu: true,
    element: <ModuleCrudFormPage />
  },
  {
    path: "/examples/module-crud/:id",
    title: "模块详情",
    hideInMenu: true,
    element: <ModuleCrudDetailPage />
  }
];
