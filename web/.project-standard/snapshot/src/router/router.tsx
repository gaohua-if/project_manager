import { createBrowserRouter, Outlet, ScrollRestoration } from "react-router-dom";

import { MainLayout } from "@/layouts/MainLayout/MainLayout";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

import { PermissionGuard } from "./PermissionGuard";
import { appRoutes } from "./routes";
import { FirstAccessibleRedirect } from "./FirstAccessibleRedirect";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/403",
    element: <ForbiddenPage />
  },
  {
    element: (
      <>
        <MainLayout>
          <Outlet />
        </MainLayout>
        <ScrollRestoration />
      </>
    ),
    children: [
      {
        index: true,
        element: <FirstAccessibleRedirect />
      },
      ...appRoutes.map((route) => ({
        path: route.path,
        element: (
          <PermissionGuard permission={route.permission}>{route.element}</PermissionGuard>
        )
      }))
    ]
  },
  {
    path: "*",
    element: <NotFoundPage />
  }
]);
