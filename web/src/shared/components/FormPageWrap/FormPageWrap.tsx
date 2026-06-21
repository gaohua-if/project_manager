import type { CSSProperties, PropsWithChildren } from "react";

import "./FormPageWrap.css";

interface FormPageWrapProps extends PropsWithChildren {
  maxWidth?: number | string;
  card?: boolean;
  density?: "compact" | "cozy" | "airy";
  className?: string;
  style?: CSSProperties;
}

export function FormPageWrap({
  maxWidth = 920,
  card = true,
  density = "cozy",
  className,
  style,
  children
}: FormPageWrapProps) {
  return (
    <div
      className={["form-page-wrap", `form-page-wrap--${density}`, className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <div
        className={card ? "form-page-wrap__inner is-card" : "form-page-wrap__inner"}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  );
}
