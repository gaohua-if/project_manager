import { App, Form } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createManagedMCPEntry } from "../../api/client";
import type { ManagedMCPEntry } from "../../api/types";
import { MCPCreateForm, type MCPCreateFormValues } from "../components/MCPCreateForm";
import { AI_ASSETS_HOME, aiAssetsPath, errorMessage } from "../utils/agentAssets";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

const AI_ASSETS_RETURN_PATH = aiAssetsPath("mcp");

export function MCPCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<MCPCreateFormValues>();

  const createMutation = useMutation({
    mutationFn: (payload: ManagedMCPEntry) => createManagedMCPEntry(payload),
    onSuccess: () => {
      message.success("MCP 已创建");
      void queryClient.invalidateQueries({ queryKey: ["managed-mcp"] });
      navigate(AI_ASSETS_RETURN_PATH);
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  return (
    <PagePanel
      title="新建 MCP Server"
      description="配置 MCP Server 基础信息、连接方式和鉴权参数"
      backTo={AI_ASSETS_RETURN_PATH}
      onBack={() => navigate(AI_ASSETS_RETURN_PATH)}
      onNavigate={(path) => navigate(path)}
      breadcrumbs={[
        { title: "系统" },
        { title: "我的 AI 资产", path: AI_ASSETS_HOME },
        { title: "MCP" },
        { title: "新建" }
      ]}
    >
      <MCPCreateForm
        form={form}
        submitting={createMutation.isPending}
        onCancel={() => navigate(AI_ASSETS_RETURN_PATH)}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
    </PagePanel>
  );
}
