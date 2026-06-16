import type { StatusTagTone } from "./StatusTag";

const statusToneMap: Record<string, StatusTagTone> = {
  running: "success",
  published: "success",
  succeeded: "success",
  success: "success",
  processing: "processing",
  pending: "warning",
  paused: "warning",
  failed: "danger",
  error: "danger",
  danger: "danger",
  draft: "neutral",
  offline: "neutral",
  normal: "neutral"
};

const statusLabelMap: Record<string, string> = {
  running: "运行中",
  published: "已发布",
  succeeded: "成功",
  success: "成功",
  processing: "处理中",
  pending: "等待中",
  paused: "已暂停",
  failed: "异常",
  error: "异常",
  draft: "草稿",
  offline: "离线",
  normal: "正常"
};

export function getStatusTagTone(status: string): StatusTagTone {
  return statusToneMap[status] ?? "neutral";
}

export function getStatusTagLabel(status: string) {
  return statusLabelMap[status] ?? status;
}
