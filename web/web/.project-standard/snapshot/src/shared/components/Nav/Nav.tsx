import { LeftOutlined } from "@ant-design/icons";
import { Breadcrumb, Space } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { appRoutes } from "@/router/routes";
import type { AppRoute } from "@/router/types";

import "./Nav.css";

export interface NavProps {
  title: string;
  description?: string;
  backTo?: string;
  onBack?: () => void;
  onNavigate?: (path: string) => void;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  variant?: "page-header" | "breadcrumb";
}

export interface BreadcrumbItem {
  title: string;
  path?: string;
}

function getBreadcrumbItems(pathname: string, title: string, routes: AppRoute[]) {
  const items: BreadcrumbItem[] = [];

  const listRoute = routes
    .filter((route) => !route.hideInMenu)
    .sort((a, b) => b.path.length - a.path.length)
    .find((route) => pathname === route.path || pathname.startsWith(`${route.path}/`));

  if (listRoute) {
    items.push({ title: listRoute.title, path: listRoute.path });
  }

  if (!items.some((item) => item.title === title)) {
    items.push({ title });
  }

  return items.length > 0 ? items : [{ title }];
}

export function Nav({
  title,
  description,
  backTo,
  onBack,
  onNavigate,
  actions,
  breadcrumbs,
  variant = "page-header"
}: NavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbItems = useMemo(
    () => breadcrumbs ?? getBreadcrumbItems(location.pathname, title, appRoutes),
    [breadcrumbs, location.pathname, title]
  );
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  const navigateToBreadcrumb = (path: string) => {
    if (onNavigate) {
      onNavigate(`${path}${location.search}`);
      return;
    }
    navigate(`${path}${location.search}`);
  };

  if (variant === "breadcrumb") {
    return (
      <Breadcrumb
        className="page-nav__breadcrumb"
        items={breadcrumbItems.map((item, index) => ({
          title:
            item.path && index < breadcrumbItems.length - 1 ? (
              <button
                type="button"
                className="page-nav__breadcrumb-button"
                onClick={() => navigateToBreadcrumb(item.path as string)}
              >
                {item.title}
              </button>
            ) : (
              item.title
            )
        }))}
      />
    );
  }

  return (
    <div className="page-nav">
      <div className="page-nav__main">
        {(backTo || onBack) && (
          <button type="button" className="page-nav__back" aria-label="返回" onClick={handleBack}>
            <LeftOutlined />
          </button>
        )}
        <div className="page-nav__heading">
          <div className="page-nav__heading-main">
            <div className="page-nav__title">{title}</div>
            {description && <div className="page-nav__subtitle">{description}</div>}
          </div>
        </div>
      </div>
      <div className="page-nav__grow" />
      {actions && <Space className="page-nav__actions">{actions}</Space>}
    </div>
  );
}
