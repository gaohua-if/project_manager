import { Button, Dropdown, Empty, Space, Table } from "antd";
import type { MenuProps, TableProps } from "antd";
import type { ReactNode } from "react";

import "./ResourceTable.css";

interface ResourceTableProps<T extends object> extends Omit<TableProps<T>, "scroll"> {
  rowKey: string | ((record: T) => string);
}

interface ResourceAction {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

/**
 * Starter table wrapper for primary resource lists.
 * Use this instead of raw AntD Table in business list pages.
 * The starter does not add table-internal scrolling. Product-specific overflow
 * behavior must be an explicit project-level customization.
 */
export function ResourceTable<T extends object>(props: ResourceTableProps<T>) {
  return (
    <Table<T>
      size="middle"
      locale={{
        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      }}
      {...props}
    />
  );
}

interface ResourceActionsProps {
  actions: ResourceAction[];
  maxInline?: number;
}

/**
 * Row action renderer with controlled inline density.
 * By default, the first two high-frequency actions stay inline and the rest move under "更多".
 */
export function ResourceActions({ actions, maxInline = 2 }: ResourceActionsProps) {
  const inlineActions = actions.slice(0, maxInline);
  const overflowActions = actions.slice(maxInline);
  const menuItems: MenuProps["items"] = overflowActions.map((action) => ({
    key: action.key,
    danger: action.danger,
    disabled: action.disabled || action.loading,
    icon: action.icon,
    label: action.label
  }));

  return (
    <Space className="resource-actions" size={4}>
      {inlineActions.map((action) => (
        <Button
          key={action.key}
          type="link"
          className={action.danger ? "resource-action resource-action--danger" : "resource-action"}
          danger={action.danger}
          disabled={action.disabled}
          icon={action.icon}
          loading={action.loading}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
      {overflowActions.length > 0 && (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: menuItems,
            onClick: ({ key }) => overflowActions.find((action) => action.key === key)?.onClick()
          }}
        >
          <Button type="link" className="resource-action resource-action-more">
            更多
          </Button>
        </Dropdown>
      )}
    </Space>
  );
}
