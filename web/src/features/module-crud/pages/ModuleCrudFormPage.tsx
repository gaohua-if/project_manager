import { Alert, Checkbox, Form, Input, InputNumber, Result, Select, Spin, Switch } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { ParameterListField } from "@/shared/components/FormPatterns/ParameterListField";
import { TwoColumnFormLayout } from "@/shared/components/FormPatterns/TwoColumnFormLayout";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

import type { ModuleFormValues } from "../api/moduleCrudTypes";
import {
  useModuleCategories,
  useModuleDetail,
  useUpdateModule
} from "../hooks/useModuleCrudQueries";
import "./ModuleCrud.css";

export function ModuleCrudFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm<ModuleFormValues>();
  const [formError, setFormError] = useState<string>();
  const backTo = buildListReturnUrl("/examples/module-crud", location.search);
  const categoriesQuery = useModuleCategories();
  const detailQuery = useModuleDetail(id);
  const updateMutation = useUpdateModule();
  const submitting = updateMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  useEffect(() => {
    if (detailQuery.data?.data) {
      form.setFieldsValue(detailQuery.data.data);
      markClean();
    }
  }, [detailQuery.data, form, markClean]);

  const handleSubmit = async (values: ModuleFormValues) => {
    setFormError(undefined);
    if (!id) {
      setFormError("缺少模块 ID，无法保存");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id, values });
      markClean();
      navigate(backTo, { replace: true });
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error);
      if (fieldErrors.length > 0) {
        form.setFields(
          fieldErrors.map((item) => ({ name: item.field, errors: [item.message] })) as Parameters<
            typeof form.setFields
          >[0]
        );
        return;
      }
      setFormError(getApiErrorMessage(error, "保存失败，请稍后重试"));
    }
  };

  if (!id) return <Result status="404" title="模块不存在" subTitle="当前模块不存在或已被删除" />;
  if (detailQuery.isLoading) return <PageSkeleton rows={10} />;
  if (detailQuery.isError)
    return <Result status="404" title="模块不存在" subTitle="当前模块不存在或已被删除" />;

  return (
    <PagePanel
      title="编辑模块"
      description="模块编辑表单使用双栏布局，右侧承载参数和资源配置"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[{ title: "Module CRUD", path: "/examples/module-crud" }, { title: "编辑模块" }]}
    >
      <FormPageWrap className="module-crud-form-wrap" maxWidth="100%" density="cozy" card>
        <Spin spinning={submitting}>
          {formError && (
            <Alert className="module-crud-form__error" type="error" showIcon message={formError} />
          )}
          <Form
            form={form}
            labelCol={{ flex: "132px" }}
            labelAlign="left"
            onFinish={handleSubmit}
            onValuesChange={markDirty}
            onFieldsChange={markDirty}
          >
            <TwoColumnFormLayout
              left={
                <>
                  <Form.Item
                    label="模块名称"
                    name="name"
                    rules={[{ required: true, message: "请输入模块名称" }]}
                  >
                    <Input className="form-item-box" placeholder="请输入模块名称" />
                  </Form.Item>
                  <Form.Item
                    label="分类"
                    name="categoryId"
                    rules={[{ required: true, message: "请选择分类" }]}
                  >
                    <Select
                      className="form-item-box"
                      options={(categoriesQuery.data?.data ?? []).map((item) => ({
                        label: item.label,
                        value: item.id
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label="负责人"
                    name="owner"
                    rules={[{ required: true, message: "请选择负责人" }]}
                  >
                    <Select
                      className="form-item-box"
                      options={["平台组", "算法组", "数据组"].map((value) => ({
                        label: value,
                        value
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label="状态"
                    name="status"
                    rules={[{ required: true, message: "请选择状态" }]}
                  >
                    <Select
                      className="form-item-box"
                      options={[
                        { label: "草稿", value: "draft" },
                        { label: "已发布", value: "published" },
                        { label: "已下线", value: "offline" }
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    label="框架"
                    name="framework"
                    rules={[{ required: true, message: "请选择框架" }]}
                  >
                    <Select
                      className="form-item-box"
                      options={["PyTorchJob", "MpiJob", "TensorFlowJob"].map((value) => ({
                        label: value,
                        value
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label="镜像地址"
                    name="image"
                    rules={[{ required: true, message: "请输入镜像地址" }]}
                  >
                    <Input
                      className="form-item-box"
                      placeholder="registry.aihub.local/train:latest"
                    />
                  </Form.Item>
                  <Form.Item
                    label="启动命令"
                    name="command"
                    rules={[{ required: true, message: "请输入启动命令" }]}
                  >
                    <Input.TextArea rows={4} placeholder="python train.py --data $dataset_path" />
                  </Form.Item>
                  <Form.Item label="标签" name="tags">
                    <Checkbox.Group options={["训练", "推理", "GPU", "CPU", "报告"]} />
                  </Form.Item>
                  <Form.Item label="说明" name="description">
                    <Input.TextArea rows={3} placeholder="请输入模块说明" />
                  </Form.Item>
                </>
              }
              right={
                <div className="module-crud-form__config">
                  <Form.Item label="总是拉取镜像" name="always_pull_image" valuePropName="checked">
                    <Switch checkedChildren="是" unCheckedChildren="否" />
                  </Form.Item>
                  <Form.Item label="超时时间" name="timeoutMinutes">
                    <InputNumber className="form-item-box" min={1} suffix="分钟" />
                  </Form.Item>
                  <Form.Item label="建议配置" name="hardware_suggestion">
                    <Input className="form-item-box" placeholder="GPU x 8 / CPU x 64" />
                  </Form.Item>
                  <ParameterListField name="envs" label="环境变量" kind="env" />
                  <ParameterListField name="inputs" label="输入参数" kind="input" />
                  <ParameterListField name="outputs" label="输出参数" kind="output" />
                </div>
              }
            />
            <FormSubmitButton submitText="保存模块" loading={submitting} onCancel={handleCancel} />
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}
