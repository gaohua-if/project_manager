import {
  ClockCircleOutlined,
  HeartOutlined,
  SwapRightOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import type { ReactNode } from "react";

import "./ModuleOrderBar.css";

export type ModuleOrderType = "asc" | "desc";

export interface ModuleOrderField {
  label: string;
  value: string;
  icon?: ReactNode;
}

interface ModuleOrderBarProps {
  fields?: ModuleOrderField[];
  orderBy: string;
  orderType: ModuleOrderType;
  onChange: (next: { orderBy: string; orderType: ModuleOrderType }) => void;
}

const defaultModuleOrderFields: ModuleOrderField[] = [
  { label: "运行次数", value: "ran_cnt", icon: <ThunderboltOutlined /> },
  { label: "引用次数", value: "used_cnt", icon: <HeartOutlined /> },
  { label: "更新时间", value: "updated_at", icon: <ClockCircleOutlined /> }
];

export function ModuleOrderBar({
  fields = defaultModuleOrderFields,
  orderBy,
  orderType,
  onChange
}: ModuleOrderBarProps) {
  const handleClick = (value: string) => {
    if (orderBy === value) {
      onChange({ orderBy, orderType: orderType === "asc" ? "desc" : "asc" });
      return;
    }

    onChange({ orderBy: value, orderType: "desc" });
  };

  return (
    <div className="module-order-bar" aria-label="模块排序">
      {fields.map((field) => {
        const isActive = orderBy === field.value;

        return (
          <button
            type="button"
            key={field.value}
            className={[
              "module-order-bar__field",
              isActive ? "is-active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleClick(field.value)}
          >
            {field.icon}
            <span>{field.label}</span>
            <span className="module-order-bar__arrows" aria-hidden>
              <SwapRightOutlined
                className={[
                  "module-order-bar__arrow",
                  "module-order-bar__arrow--up",
                  isActive && orderType === "asc" ? "is-active" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <SwapRightOutlined
                className={[
                  "module-order-bar__arrow",
                  "module-order-bar__arrow--down",
                  isActive && orderType === "desc" ? "is-active" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
