import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { useHeaderNav } from "@/layouts/Header/headerNavContext";
import { Nav } from "@/shared/components/Nav/Nav";
import type { BreadcrumbItem, NavProps } from "@/shared/components/Nav/Nav";

import "./PagePanel.css";

interface PagePanelProps extends NavProps {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  showNav?: boolean;
}

/**
 * Standard page shell for business pages.
 * Use it as the root of list, form, detail, dashboard, and gallery pages.
 * Breadcrumb metadata is registered in the app header.
 * The page title, description, and actions render in the content area.
 */
export function PagePanel({
  children,
  className,
  bodyClassName,
  showNav,
  title,
  description,
  backTo,
  onBack,
  onNavigate,
  actions,
  breadcrumbs
}: PagePanelProps) {
  const shouldShowNav = showNav ?? true;
  const { setNavProps } = useHeaderNav();
  const onBackRef = useRef(onBack);
  const onNavigateRef = useRef(onNavigate);
  const hasOnBack = Boolean(onBack);
  const hasOnNavigate = Boolean(onNavigate);
  const handleBack = useCallback(() => onBackRef.current?.(), []);
  const handleNavigate = useCallback((path: string) => onNavigateRef.current?.(path), []);
  const breadcrumbsKey = breadcrumbs ? JSON.stringify(breadcrumbs) : "";
  const stableBreadcrumbs = useMemo(
    () => (breadcrumbsKey ? (JSON.parse(breadcrumbsKey) as BreadcrumbItem[]) : undefined),
    [breadcrumbsKey]
  );
  const navProps = useMemo(
    () => ({
      title,
      description,
      backTo,
      onBack: hasOnBack ? handleBack : undefined,
      onNavigate: hasOnNavigate ? handleNavigate : undefined,
      breadcrumbs: stableBreadcrumbs
    }),
    [
      backTo,
      description,
      handleBack,
      handleNavigate,
      hasOnBack,
      hasOnNavigate,
      stableBreadcrumbs,
      title
    ]
  );

  useLayoutEffect(() => {
    onBackRef.current = onBack;
    onNavigateRef.current = onNavigate;
  }, [onBack, onNavigate]);

  useLayoutEffect(() => {
    if (!navProps) return;

    // PagePanel owns the header breadcrumb metadata while it is mounted.
    setNavProps(navProps);
    return () => {
      setNavProps((current) => (current === navProps ? null : current));
    };
  }, [navProps, setNavProps]);

  return (
    <section className={["page-panel", className].filter(Boolean).join(" ")}>
      {shouldShowNav && (
        <Nav
          title={title}
          description={description}
          backTo={backTo}
          onBack={hasOnBack ? handleBack : undefined}
          onNavigate={hasOnNavigate ? handleNavigate : undefined}
          actions={actions}
        />
      )}
      <div className={["page-panel__body", bodyClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </section>
  );
}
