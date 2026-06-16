import { BaseUpload } from "./BaseUpload";
import type { BaseUploadProps } from "./BaseUpload";

export function FileUpload(props: BaseUploadProps) {
  return <BaseUpload {...props} />;
}
