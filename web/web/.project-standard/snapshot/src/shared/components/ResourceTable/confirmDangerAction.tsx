import type { ReactNode } from "react";
import { ExclamationCircleFilled } from "@ant-design/icons";

import { feedback } from "@/shared/feedback/feedback";
import "./confirmDangerAction.css";

export function confirmDangerAction(options: {
  title: string;
  content?: ReactNode;
  okText?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const modal = feedback.modal();
  if (!modal) {
    void options.onConfirm();
    return;
  }

  modal.confirm({
    title: options.title,
    content: options.content,
    className: "danger-confirm-modal",
    maskStyle: { background: "rgba(15, 23, 42, 0.45)" },
    icon: <ExclamationCircleFilled />,
    centered: true,
    okText: options.okText ?? "确认",
    cancelText: "取消",
    okButtonProps: { danger: true, className: "danger-confirm-modal__ok" },
    cancelButtonProps: { className: "danger-confirm-modal__cancel" },
    onOk: options.onConfirm
  });
}
