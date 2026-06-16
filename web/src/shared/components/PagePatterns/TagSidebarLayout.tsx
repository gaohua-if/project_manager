import type { PropsWithChildren } from "react";

import "./TagSidebarLayout.css";

export interface TagSidebarItem {
  key: string;
  label: string;
  count?: number;
  color?: string;
}

interface TagSidebarLayoutProps extends PropsWithChildren {
  items: TagSidebarItem[];
  activeKey: string;
  onChange?: (key: string) => void;
}

export function TagSidebarLayout({
  items,
  activeKey,
  onChange,
  children
}: TagSidebarLayoutProps) {
  return (
    <div className="tag-sidebar-layout">
      <aside className="tag-sidebar-layout__sidebar">
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            className={[
              "tag-sidebar-layout__item",
              item.key === activeKey ? "is-active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange?.(item.key)}
          >
            <span
              className="tag-sidebar-layout__dot"
              style={{ backgroundColor: item.color ?? "var(--aihub-color-primary)" }}
            />
            <span className="tag-sidebar-layout__label">{item.label}</span>
            {typeof item.count === "number" && (
              <span className="tag-sidebar-layout__count">{item.count}</span>
            )}
          </button>
        ))}
      </aside>
      <div className="tag-sidebar-layout__content">{children}</div>
    </div>
  );
}
