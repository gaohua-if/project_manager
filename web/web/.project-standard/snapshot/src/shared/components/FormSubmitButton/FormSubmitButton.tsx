import { Button, Space } from "antd";
import type { ReactNode } from "react";

import "./FormSubmitButton.css";

interface FormSubmitButtonProps {
  submitText?: ReactNode;
  cancelText?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  extra?: ReactNode;
  align?: "left" | "center" | "right";
  sticky?: boolean;
}

export function FormSubmitButton({
  submitText = "确定",
  cancelText = "取消",
  loading,
  disabled,
  onCancel,
  extra,
  align = "right",
  sticky = false
}: FormSubmitButtonProps) {
  return (
    <div
      className={sticky ? "form-submit-button is-sticky" : "form-submit-button"}
      data-align={align}
      role="toolbar"
    >
      <div className="form-submit-button__inner">
        <Space size={12}>
          {onCancel && <Button onClick={onCancel}>{cancelText}</Button>}
          <Button type="primary" htmlType="submit" loading={loading} disabled={disabled}>
            {submitText}
          </Button>
          {extra}
        </Space>
      </div>
    </div>
  );
}
