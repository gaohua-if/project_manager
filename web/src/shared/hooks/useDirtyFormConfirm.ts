import type { FormInstance } from "antd";
import { useCallback } from "react";

import { useFormLeaveConfirm } from "./useFormLeaveConfirm";

interface DirtyFormConfirmOptions {
  form: FormInstance;
  submitting?: boolean;
  onConfirm: () => void;
}

export function useDirtyFormConfirm({
  form,
  submitting = false,
  onConfirm
}: DirtyFormConfirmOptions) {
  const { confirmLeave } = useFormLeaveConfirm({ form, submitting });
  return useCallback(() => confirmLeave(onConfirm), [confirmLeave, onConfirm]);
}
