import { App, Form } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createManagedSkill } from "../../api/client";
import type { CreateManagedSkillPayload } from "../../api/types";
import { SkillCreateForm, type SkillCreateFormValues } from "../components/SkillCreateForm";
import { errorMessage } from "../utils/agentAssets";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

const AI_ASSETS_HOME = "/ai-assets";

export function SkillCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<SkillCreateFormValues>();

  const createMutation = useMutation({
    mutationFn: (payload: CreateManagedSkillPayload) => createManagedSkill(payload),
    onSuccess: () => {
      message.success("Skill 已创建");
      void queryClient.invalidateQueries({ queryKey: ["managed-skills"] });
      navigate(AI_ASSETS_HOME);
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  return (
    <PagePanel
      title="新建 Skill"
      description="创建一个只包含 SKILL.md 的 Managed Agent Skill"
      backTo={AI_ASSETS_HOME}
      onBack={() => navigate(AI_ASSETS_HOME)}
      onNavigate={(path) => navigate(path)}
      breadcrumbs={[
        { title: "系统" },
        { title: "我的 AI 资产", path: AI_ASSETS_HOME },
        { title: "Skill" },
        { title: "新建" }
      ]}
    >
      <SkillCreateForm
        form={form}
        submitting={createMutation.isPending}
        onCancel={() => navigate(AI_ASSETS_HOME)}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
    </PagePanel>
  );
}
