import { Tag } from "antd";
import type { ReactNode } from "react";

import { getStatusTagLabel, getStatusTagTone } from "./statusTagMeta";
import "./StatusTag.css";

export type StatusTagTone = "success" | "processing" | "warning" | "danger" | "neutral";

interface StatusTagProps {
  status: string;
  children?: ReactNode;
  tone?: StatusTagTone;
}

export function StatusTag({ status, children, tone }: StatusTagProps) {
  const resolvedTone = tone ?? getStatusTagTone(status);
  return <Tag className={`status-tag status-tag--${resolvedTone}`}>{children ?? getStatusTagLabel(status)}</Tag>;
}
