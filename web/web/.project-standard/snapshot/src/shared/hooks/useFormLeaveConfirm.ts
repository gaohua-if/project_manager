import type { FormInstance } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { createElement } from "react";
import { useBeforeUnload } from "react-router-dom";

import { feedback } from "@/shared/feedback/feedback";
import "./formLeaveConfirm.css";

interface FormLeaveConfirmOptions {
  form?: FormInstance;
  submitting?: boolean;
}

export function useFormLeaveConfirm({
  form,
  submitting = false
}: FormLeaveConfirmOptions) {
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const baselineRef = useRef<string>();

  const serialize = useCallback((value: unknown) => JSON.stringify(value, (_key, item) => {
    if (item instanceof File) return item.name;
    return item;
  }), []);

  const clearTouched = useCallback(() => {
    if (!form) return;

    const collect = (value: unknown, prefix: Array<string | number> = []): Array<Array<string | number>> => {
      if (Array.isArray(value)) {
        return value.flatMap((item, index) => collect(item, [...prefix, index]));
      }
      if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => collect(item, [...prefix, key]));
      }
      return prefix.length > 0 ? [prefix] : [];
    };

    form.setFields(collect(form.getFieldsValue(true)).map((name) => ({ name, touched: false })));
  }, [form]);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    setDirty(false);
    baselineRef.current = form ? serialize(form.getFieldsValue(true)) : undefined;
    clearTouched();
    window.setTimeout(clearTouched, 0);
  }, [clearTouched, form, serialize]);

  const markDirty = useCallback(() => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  const isDirty = useCallback(() => {
    if (dirtyRef.current) return true;
    if (!form || baselineRef.current === undefined) return false;
    return serialize(form.getFieldsValue(true)) !== baselineRef.current;
  }, [form, serialize]);

  const confirmLeave = useCallback((onConfirm: () => void) => {
    if (submitting || !isDirty()) {
      onConfirm();
      return;
    }

    const modal = feedback.modal();
    if (!modal) {
      onConfirm();
      return;
    }

    modal.confirm({
      title: "确认离开当前页面？",
      content: "表单内容尚未保存，离开后已填写内容将丢失。",
      className: "form-leave-confirm-modal",
      maskStyle: { background: "rgba(15, 23, 42, 0.45)" },
      icon: createElement(ExclamationCircleFilled),
      centered: true,
      okText: "继续编辑",
      cancelText: "离开",
      okButtonProps: { className: "form-leave-confirm-modal__continue" },
      cancelButtonProps: { className: "form-leave-confirm-modal__leave" },
      onCancel: onConfirm
    });
  }, [isDirty, submitting]);

  useBeforeUnload(
    useCallback((event: BeforeUnloadEvent) => {
      if (!isDirty() || submitting) return;
      event.preventDefault();
      event.returnValue = "";
    }, [isDirty, submitting])
  );

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  return { dirty, markClean, markDirty, confirmLeave };
}
