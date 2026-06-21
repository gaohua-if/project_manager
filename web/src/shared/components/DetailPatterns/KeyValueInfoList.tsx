import { Tag } from "antd";
import type { ReactNode } from "react";

import "./KeyValueInfoList.css";

export interface KeyValueInfoItem {
  key: string;
  label: string;
  description?: ReactNode;
  required?: boolean;
  type?: ReactNode;
  path?: ReactNode;
  value?: ReactNode;
}

interface KeyValueInfoListProps {
  title?: string;
  icon?: ReactNode;
  items: KeyValueInfoItem[];
  emptyText?: string;
  tagColor?: string;
  outputMode?: boolean;
}

export function KeyValueInfoList({
  title,
  icon,
  items,
  emptyText = "无",
  tagColor = "blue",
  outputMode = false
}: KeyValueInfoListProps) {
  return (
    <div className="key-value-info-list">
      {title && (
        <div className="key-value-info-list__title">
          {icon}
          {title}
        </div>
      )}
      {items.length === 0 ? (
        <div className="key-value-info-list__empty">{emptyText}</div>
      ) : (
        <div className="key-value-info-list__rows">
          {items.map((item) => (
            <div
              key={item.key}
              className={[
                "key-value-info-list__row",
                outputMode ? "key-value-info-list__row--output" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="key-value-info-list__tag-group">
                <Tag color={tagColor} className="key-value-info-list__tag">
                  {item.label}
                </Tag>
                {!outputMode && (
                  <Tag
                    color={item.required ? "orange" : "default"}
                    className="key-value-info-list__required"
                  >
                    {item.required ? "必填" : "非必填"}
                  </Tag>
                )}
              </div>
              {outputMode ? (
                <div className="key-value-info-list__stack">
                  {item.type && <div className="key-value-info-list__meta">类型: {item.type}</div>}
                  {item.path && <div className="key-value-info-list__meta">路径: {item.path}</div>}
                  <div className="key-value-info-list__meta">描述: {item.description ?? "-"}</div>
                </div>
              ) : (
                <div className="key-value-info-list__description">{item.description ?? "-"}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
