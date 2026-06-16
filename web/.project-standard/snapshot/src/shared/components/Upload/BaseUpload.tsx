import { CloudUploadOutlined } from "@ant-design/icons";
import { Button, Upload } from "antd";
import type { UploadFile, UploadProps } from "antd";
import type { RcFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";

import { api } from "@/shared/request/httpClient";
import { feedback } from "@/shared/feedback/feedback";

import "./Upload.css";

type UploadRequestOption = Parameters<NonNullable<UploadProps["customRequest"]>>[0];

export interface UploadResponseData {
  url?: string;
  path?: string;
  [key: string]: unknown;
}

export interface BaseUploadProps extends Omit<UploadProps, "onChange" | "fileList" | "customRequest"> {
  value?: string | string[];
  uploadUrl?: string;
  fileType?: "image" | "csv" | "zip" | "yaml" | "md";
  size?: number;
  readAsText?: boolean;
  readAsFile?: boolean;
  returnType?: "url" | "path" | "file";
  tips?: string;
  buttonText?: string;
  onChange?: (value: string | string[] | File | null, file?: UploadFile) => void;
}

function validateFile(file: RcFile, fileType?: BaseUploadProps["fileType"], size?: number) {
  if (fileType === "image" && file.type && !file.type.startsWith("image/")) {
    feedback.message()?.error("请上传图片文件");
    return false;
  }

  const extensionMap: Record<string, string[]> = {
    csv: [".csv"],
    zip: [".zip"],
    yaml: [".yaml", ".yml"],
    md: [".md"]
  };
  const extensions = fileType ? extensionMap[fileType] : undefined;
  if (extensions && !extensions.some((extension) => file.name.endsWith(extension))) {
    feedback.message()?.error(`请上传 ${extensions.join(" / ")} 文件`);
    return false;
  }

  if (size && file.size / 1024 / 1024 > size) {
    feedback.message()?.error(`文件大小不能超过 ${size}MB`);
    return false;
  }

  return true;
}

function getReturnedValue(response: UploadResponseData, returnType: BaseUploadProps["returnType"]) {
  if (returnType === "path") return response.path ?? response.url ?? "";
  return response.url ?? response.path ?? "";
}

export function BaseUpload({
  value,
  uploadUrl,
  fileType,
  size,
  readAsText = false,
  readAsFile = false,
  returnType = "url",
  tips,
  buttonText = "上传",
  multiple = false,
  showUploadList = true,
  onChange,
  children,
  ...props
}: BaseUploadProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (readAsText || readAsFile) return;
    const values = Array.isArray(value) ? value : value ? [value] : [];
    setFileList(values.map((item) => ({ uid: item, name: item, url: item, status: "done" })));
  }, [readAsFile, readAsText, value]);

  const customRequest = async (options: UploadRequestOption) => {
    const file = options.file as RcFile;
    if (!validateFile(file, fileType, size)) {
      options.onError?.(new Error("文件校验失败"));
      return;
    }

    const uploadingFile: UploadFile = { uid: file.uid, name: file.name, status: "uploading" };
    setFileList((prev) => (multiple ? [...prev, uploadingFile] : [uploadingFile]));

    try {
      if (readAsFile) {
        const doneFile = { ...uploadingFile, status: "done" as const };
        setFileList((prev) => prev.map((item) => (item.uid === file.uid ? doneFile : item)));
        onChange?.(file, doneFile);
        options.onSuccess?.(file);
        return;
      }

      if (readAsText) {
        const text = await file.text();
        const doneFile = { ...uploadingFile, status: "done" as const };
        setFileList((prev) => prev.map((item) => (item.uid === file.uid ? doneFile : item)));
        onChange?.(text, doneFile);
        options.onSuccess?.(text);
        return;
      }

      if (!uploadUrl) throw new Error("未配置上传地址");
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post<UploadResponseData>(uploadUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const returnedValue = getReturnedValue(response.data, returnType);
      const doneFile = { ...uploadingFile, status: "done" as const, url: returnedValue };
      setFileList((prev) => prev.map((item) => (item.uid === file.uid ? doneFile : item)));
      onChange?.(multiple ? [...(Array.isArray(value) ? value : []), returnedValue] : returnedValue, doneFile);
      options.onSuccess?.(response.data);
    } catch (error) {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      feedback.message()?.error(error instanceof Error ? error.message : "上传失败");
      options.onError?.(error as Error);
    }
  };

  return (
    <div className="base-upload">
      <Upload
        {...props}
        multiple={multiple}
        showUploadList={showUploadList}
        fileList={fileList}
        customRequest={customRequest}
        onRemove={(file) => {
          setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
          onChange?.(null, file);
        }}
      >
        {children ?? (
          <Button icon={<CloudUploadOutlined />} disabled={props.disabled}>
            {buttonText}
          </Button>
        )}
      </Upload>
      {tips && <span className="base-upload__tips">{tips}</span>}
    </div>
  );
}
