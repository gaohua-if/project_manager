import { App, Form } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { createManagedAgent, fetchManagedMCPEntries, fetchManagedSkills } from "../../api/client";
import type { UpsertManagedAgentPayload } from "../../api/types";
import { AgentEditor, type AgentEditorValues } from "../components/AgentEditor";
import { errorMessage } from "../utils/agentAssets";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

const AI_ASSETS_HOME = "/ai-assets";

export function AgentCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<AgentEditorValues>();

  const skillsQuery = useQuery({
    queryKey: ["managed-skills", "mine"],
    queryFn: () => fetchManagedSkills("mine"),
    staleTime: 60_000
  });
  const mcpQuery = useQuery({
    queryKey: ["managed-mcp", "mine"],
    queryFn: () => fetchManagedMCPEntries("mine"),
    staleTime: 60_000
  });

  const skills = useMemo(() => skillsQuery.data?.skills ?? [], [skillsQuery.data]);
  const mcpEntries = useMemo(() => mcpQuery.data?.entries ?? [], [mcpQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: UpsertManagedAgentPayload) => createManagedAgent(payload),
    onSuccess: () => {
      message.success("Agent 已创建");
      void queryClient.invalidateQueries({ queryKey: ["managed-agents"] });
      navigate(AI_ASSETS_HOME);
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  useEffect(() => {
    form.setFieldsValue({ engine: "codex", skills: [], mcp_bindings: [] });
  }, [form]);

  return (
    <PagePanel
      title="新建 Managed Agent"
      description="配置 Agent 基础信息、运行参数、Prompt 和资源绑定"
      backTo={AI_ASSETS_HOME}
      onBack={() => navigate(AI_ASSETS_HOME)}
      onNavigate={(path) => navigate(path)}
      breadcrumbs={[
        { title: "系统" },
        { title: "我的 AI 资产", path: AI_ASSETS_HOME },
        { title: "新建 Agent" }
      ]}
    >
      <AgentEditor
        form={form}
        agent={null}
        skills={skills}
        mcpEntries={mcpEntries}
        submitting={createMutation.isPending}
        onCancel={() => navigate(AI_ASSETS_HOME)}
        onSubmit={(payload: UpsertManagedAgentPayload) => createMutation.mutate(payload)}
      />
    </PagePanel>
  );
}

