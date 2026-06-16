import type { ReactNode } from "react";

import "./TwoColumnFormLayout.css";

interface TwoColumnFormLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export function TwoColumnFormLayout({ left, right }: TwoColumnFormLayoutProps) {
  return (
    <div className="two-column-form-layout">
      <div className="two-column-form-layout__column">{left}</div>
      <div className="two-column-form-layout__column">{right}</div>
    </div>
  );
}
