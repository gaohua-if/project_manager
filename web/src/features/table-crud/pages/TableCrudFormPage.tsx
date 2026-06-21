import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Result,
  Select,
  Spin,
  Steps,
  Switch
} from "antd";
import type { FormInstance } from "antd/es/form";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { ParameterListField } from "@/shared/components/FormPatterns/ParameterListField";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { FileUpload } from "@/shared/components/Upload/FileUpload";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildCreateSuccessUrl, buildListReturnUrl } from "@/shared/utils/urlQuery";

import type { TableResourceFormValues } from "../api/tableCrudTypes";
import {
  useCreateTableResource,
  useTableResourceDetail,
  useUpdateTableResource
} from "../hooks/useTableCrudQueries";
import "./TableCrud.css";

export type TableCrudFormVariant = "simple" | "standard" | "advanced" | "steps";

interface TableCrudFormPageProps {
  variant?: TableCrudFormVariant;
}

type FormShape = Omit<TableResourceFormValues, "effectiveDate"> & {
  effectiveDate?: dayjs.Dayjs;
};

const ownerOptions = ["平台组", "算法组", "工程组", "数据组"].map((value) => ({
  label: value,
  value
}));

const regionOptions = ["华北一区", "华东一区", "华南一区"].map((value) => ({
  label: value,
  value
}));

const statusOptions = [
  { label: "运行中", value: "running" },
  { label: "已暂停", value: "paused" },
  { label: "异常", value: "failed" },
  { label: "草稿", value: "draft" }
];

const priorityOptions = [
  { label: "高", value: "high" },
  { label: "正常", value: "normal" },
  { label: "低", value: "low" }
];

const tagOptions = ["训练", "推理", "GPU", "CPU", "生产"];

const steppedFormSteps: Array<{
  key: string;
  title: string;
  fields: Array<keyof FormShape>;
}> = [
  {
    key: "identity",
    title: "基础信息",
    fields: ["name", "owner", "region"]
  },
  {
    key: "runtime",
    title: "运行配置",
    fields: ["status", "priority", "quota", "enabled", "effectiveDate"]
  },
  {
    key: "extension",
    title: "扩展信息",
    fields: ["tags", "envs", "attachment", "description"]
  }
];

const variantMeta: Record<TableCrudFormVariant, { createTitle: string }> = {
  simple: {
    createTitle: "新建 Table 资源 - 简单表单"
  },
  standard: {
    createTitle: "新建 Table 资源"
  },
  advanced: {
    createTitle: "新建 Table 资源 - 大型表单"
  },
  steps: {
    createTitle: "新建 Table 资源 - 分步骤表单"
  }
};

function mapToValues(values: FormShape): TableResourceFormValues {
  return {
    ...values,
    effectiveDate: values.effectiveDate?.format("YYYY-MM-DD")
  };
}

export function TableCrudFormPage({ variant = "standard" }: TableCrudFormPageProps) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm<FormShape>();
  const [formError, setFormError] = useState<string>();
  const isEdit = Boolean(id);
  const effectiveVariant = isEdit ? "standard" : variant;
  const [stepState, setStepState] = useState<{ step: number; variant: TableCrudFormVariant }>({
    step: 0,
    variant: effectiveVariant
  });
  const activeStep = stepState.variant === effectiveVariant ? stepState.step : 0;
  const setActiveStep = (step: number) => setStepState({ step, variant: effectiveVariant });
  const meta = variantMeta[effectiveVariant];
  const backTo = buildListReturnUrl("/examples/table-crud", location.search);
  const detailQuery = useTableResourceDetail(id);
  const createMutation = useCreateTableResource();
  const updateMutation = useUpdateTableResource();
  const submitting = createMutation.isPending || updateMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  const title = useMemo(
    () => (isEdit ? "编辑 Table 资源" : meta.createTitle),
    [isEdit, meta.createTitle]
  );
  const advancedDefaultKeys = useMemo(() => (isEdit ? ["advanced"] : []), [isEdit]);

  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({
        owner: "平台组",
        status: "running",
        priority: "normal",
        region: "华北一区",
        quota: 1,
        enabled: true,
        tags: ["训练"],
        envs:
          effectiveVariant === "advanced" || effectiveVariant === "steps"
            ? [{ key: "RUNTIME_ENV", is_optional: false, description: "资源运行环境" }]
            : undefined
      });
      markClean();
      return;
    }

    const data = detailQuery.data?.data;
    if (data) {
      form.setFieldsValue({
        ...data,
        effectiveDate: data.effectiveDate ? dayjs(data.effectiveDate) : undefined
      });
      markClean();
    }
  }, [detailQuery.data, effectiveVariant, form, isEdit, markClean]);

  const handleSubmit = async (values: FormShape) => {
    setFormError(undefined);
    try {
      if (id) {
        await updateMutation.mutateAsync({ id, values: mapToValues(values) });
      } else {
        await createMutation.mutateAsync(mapToValues(values));
      }
      markClean();
      navigate(id ? backTo : buildCreateSuccessUrl("/examples/table-crud", location.search), {
        replace: true
      });
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

  if (isEdit && detailQuery.isLoading) return <PageSkeleton rows={10} />;
  if (isEdit && detailQuery.isError) {
    return <Result status="404" title="资源不存在" subTitle="当前资源不存在或已被删除" />;
  }

  return (
    <PagePanel
      title={title}
      className="table-crud-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[{ title: "Table CRUD", path: "/examples/table-crud" }, { title }]}
    >
      <FormPageWrap
        className={`table-crud-form-wrap table-crud-form-wrap--${effectiveVariant}`}
        maxWidth="100%"
        density="cozy"
        card
      >
        <Spin spinning={submitting}>
          {formError && (
            <Alert className="table-crud-form__error" type="error" showIcon message={formError} />
          )}

          <Form
            form={form}
            labelCol={{ flex: "104px" }}
            wrapperCol={{ flex: "1" }}
            labelAlign="left"
            onFinish={handleSubmit}
            onValuesChange={markDirty}
            onFieldsChange={markDirty}
          >
            {effectiveVariant === "simple" && renderSimpleForm(submitting, handleCancel)}
            {effectiveVariant === "standard" &&
              renderStandardForm(advancedDefaultKeys, submitting, handleCancel, isEdit)}
            {effectiveVariant === "advanced" && renderAdvancedForm(submitting, handleCancel)}
            {effectiveVariant === "steps" &&
              renderSteppedForm({
                activeStep,
                form,
                handleCancel,
                setActiveStep,
                submitting
              })}
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}

function renderSimpleForm(submitting: boolean, handleCancel: () => void) {
  return (
    <>
      <Form.Item name="priority" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="region" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="quota" hidden>
        <InputNumber />
      </Form.Item>

      <section className="table-crud-form__section">
        <div className="table-crud-form__section-head">
          <h2>轻量信息</h2>
          <p>只暴露快速创建所需的核心字段，其余字段使用模板默认值。</p>
        </div>

        <div className="table-crud-form__grid table-crud-form__grid--simple">
          <Form.Item
            label="资源名称"
            name="name"
            rules={[{ required: true, message: "请输入资源名称" }]}
          >
            <Input className="form-item-box" placeholder="请输入资源名称" />
          </Form.Item>

          <Form.Item
            label="负责人"
            name="owner"
            rules={[{ required: true, message: "请选择负责人" }]}
          >
            <Select className="form-item-box" placeholder="请选择负责人" options={ownerOptions} />
          </Form.Item>

          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select className="form-item-box" options={statusOptions} />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            className="table-crud-form__full-row"
            label="备注"
            name="description"
            rules={[{ max: 300, message: "备注不能超过 300 个字符" }]}
          >
            <Input.TextArea rows={3} maxLength={300} placeholder="请输入备注" />
          </Form.Item>
        </div>
      </section>

      <FormSubmitButton submitText="创建资源" loading={submitting} onCancel={handleCancel} />
    </>
  );
}

function renderStandardForm(
  advancedDefaultKeys: string[],
  submitting: boolean,
  handleCancel: () => void,
  isEdit: boolean
) {
  return (
    <>
      <section className="table-crud-form__section">
        <div className="table-crud-form__section-head">
          <h2>基础信息</h2>
          <p>把用户最常填写和校验最关键的字段放在第一屏。</p>
        </div>

        <div className="table-crud-form__grid">
          <Form.Item
            label="资源名称"
            name="name"
            rules={[{ required: true, message: "请输入资源名称" }]}
          >
            <Input className="form-item-box" placeholder="请输入资源名称" />
          </Form.Item>

          <Form.Item
            label="负责人"
            name="owner"
            rules={[{ required: true, message: "请选择负责人" }]}
          >
            <Select className="form-item-box" placeholder="请选择负责人" options={ownerOptions} />
          </Form.Item>

          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select className="form-item-box" options={statusOptions} />
          </Form.Item>

          <Form.Item label="区域" name="region" rules={[{ required: true, message: "请选择区域" }]}>
            <Select className="form-item-box" placeholder="请选择区域" options={regionOptions} />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: "请选择优先级" }]}
          >
            <Select className="form-item-box" options={priorityOptions} />
          </Form.Item>

          <Form.Item label="配额" name="quota" rules={[{ required: true, message: "请输入配额" }]}>
            <InputNumber className="form-item-box" min={1} max={16} />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="生效日期" name="effectiveDate">
            <DatePicker className="form-item-box" placeholder="请选择日期" />
          </Form.Item>
        </div>
      </section>

      <Collapse
        className="table-crud-form__advanced"
        defaultActiveKey={advancedDefaultKeys}
        items={[
          {
            key: "advanced",
            label: "高级配置",
            children: (
              <div className="table-crud-form__advanced-grid">
                <Form.Item label="标签" name="tags">
                  <Checkbox.Group options={tagOptions} />
                </Form.Item>

                <Form.Item label="附件" name="attachment">
                  <FileUpload
                    readAsFile
                    buttonText="选择文件"
                    tips="本地读取模式；接入真实接口后可替换为 uploadUrl。"
                  />
                </Form.Item>

                <Form.Item
                  label="描述"
                  name="description"
                  rules={[{ max: 500, message: "描述不能超过 500 个字符" }]}
                >
                  <Input.TextArea
                    rows={3}
                    maxLength={500}
                    placeholder="请输入资源描述、使用边界或维护说明"
                  />
                </Form.Item>
              </div>
            )
          }
        ]}
      />

      <FormSubmitButton
        submitText={isEdit ? "保存资源" : "创建资源"}
        loading={submitting}
        onCancel={handleCancel}
      />
    </>
  );
}

interface RenderSteppedFormArgs {
  activeStep: number;
  form: FormInstance<FormShape>;
  handleCancel: () => void;
  setActiveStep: (step: number) => void;
  submitting: boolean;
}

function scrollSteppedFormToTop() {
  window.requestAnimationFrame(() => {
    const container = document.getElementById("main-content-scroll-container");
    const target = document.querySelector<HTMLElement>(".table-crud-form-wrap--steps");
    if (!container || !target) return;

    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const nextTop = container.scrollTop + targetTop - containerTop - 12;

    container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  });
}

function renderSteppedForm({
  activeStep,
  form,
  handleCancel,
  setActiveStep,
  submitting
}: RenderSteppedFormArgs) {
  const lastStepIndex = steppedFormSteps.length - 1;
  const currentStep = steppedFormSteps[activeStep] ?? steppedFormSteps[0];

  const moveToStep = async (nextStep: number) => {
    if (nextStep < 0 || nextStep > lastStepIndex) return;

    if (nextStep > activeStep) {
      await form.validateFields(currentStep.fields as string[]);
    }

    setActiveStep(nextStep);
    scrollSteppedFormToTop();
  };

  const stepItems = steppedFormSteps.map((step, index) => ({
    title: step.title,
    disabled: index > activeStep + 1
  }));

  return (
    <div className="table-crud-form__steps" data-active-step={activeStep}>
      <Steps
        className="table-crud-form__stepper"
        current={activeStep}
        items={stepItems}
        onChange={(nextStep) => {
          void moveToStep(nextStep);
        }}
      />

      <div className="table-crud-form__step-body">
        {steppedFormSteps.map((step, index) => (
          <section
            key={step.key}
            className="table-crud-form__step-panel"
            data-step-key={step.key}
            hidden={activeStep !== index}
            aria-hidden={activeStep !== index}
          >
            {index === 0 && (
              <>
                <div className="table-crud-form__section-head">
                  <h2>基础信息</h2>
                </div>
                <div className="table-crud-form__grid">
                  <Form.Item
                    label="资源名称"
                    name="name"
                    rules={[{ required: true, message: "请输入资源名称" }]}
                  >
                    <Input className="form-item-box" placeholder="请输入资源名称" />
                  </Form.Item>

                  <Form.Item
                    label="负责人"
                    name="owner"
                    rules={[{ required: true, message: "请选择负责人" }]}
                  >
                    <Select
                      className="form-item-box"
                      placeholder="请选择负责人"
                      options={ownerOptions}
                    />
                  </Form.Item>

                  <Form.Item
                    label="区域"
                    name="region"
                    rules={[{ required: true, message: "请选择区域" }]}
                  >
                    <Select
                      className="form-item-box"
                      placeholder="请选择区域"
                      options={regionOptions}
                    />
                  </Form.Item>
                </div>
              </>
            )}

            {index === 1 && (
              <>
                <div className="table-crud-form__section-head">
                  <h2>运行配置</h2>
                </div>
                <div className="table-crud-form__grid">
                  <Form.Item
                    label="状态"
                    name="status"
                    rules={[{ required: true, message: "请选择状态" }]}
                  >
                    <Select className="form-item-box" options={statusOptions} />
                  </Form.Item>

                  <Form.Item
                    label="优先级"
                    name="priority"
                    rules={[{ required: true, message: "请选择优先级" }]}
                  >
                    <Select className="form-item-box" options={priorityOptions} />
                  </Form.Item>

                  <Form.Item
                    label="配额"
                    name="quota"
                    rules={[{ required: true, message: "请输入配额" }]}
                  >
                    <InputNumber className="form-item-box" min={1} max={16} />
                  </Form.Item>

                  <Form.Item label="启用" name="enabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="生效日期" name="effectiveDate">
                    <DatePicker className="form-item-box" placeholder="请选择日期" />
                  </Form.Item>
                </div>
              </>
            )}

            {index === 2 && (
              <>
                <div className="table-crud-form__section-head">
                  <h2>扩展信息</h2>
                </div>
                <div className="table-crud-form__step-extension">
                  <Form.Item label="标签" name="tags">
                    <Checkbox.Group options={tagOptions} />
                  </Form.Item>

                  <ParameterListField
                    name="envs"
                    label="环境变量声明"
                    kind="env"
                    tooltip="声明资源运行时需要的环境变量 Key，不在此处填写具体密钥值。"
                  />

                  <Form.Item label="附件" name="attachment">
                    <FileUpload
                      readAsFile
                      buttonText="选择文件"
                      tips="本地读取模式；接入真实接口后可替换为 uploadUrl。"
                    />
                  </Form.Item>

                  <Form.Item
                    label="描述"
                    name="description"
                    rules={[{ max: 500, message: "描述不能超过 500 个字符" }]}
                  >
                    <Input.TextArea
                      rows={3}
                      maxLength={500}
                      placeholder="请输入资源描述、使用边界或维护说明"
                    />
                  </Form.Item>
                </div>
              </>
            )}
          </section>
        ))}
      </div>

      <div className="table-crud-form__step-actions">
        <Button onClick={handleCancel}>取消</Button>
        <Button disabled={activeStep === 0} onClick={() => void moveToStep(activeStep - 1)}>
          上一步
        </Button>
        {activeStep < lastStepIndex ? (
          <Button type="primary" onClick={() => void moveToStep(activeStep + 1)}>
            下一步
          </Button>
        ) : (
          <Button type="primary" htmlType="submit" loading={submitting}>
            创建资源
          </Button>
        )}
      </div>
    </div>
  );
}

function renderAdvancedForm(submitting: boolean, handleCancel: () => void) {
  const sectionNames = ["基础信息", "运行配置", "资源配置", "环境变量", "材料上传", "高级策略"];
  const scrollToSection = (sectionName: string) => {
    const target = document.getElementById(sectionName);
    if (!target) return;

    const container =
      target.closest<HTMLElement>(".table-crud-form-wrap--advanced .form-page-wrap__inner") ??
      document.getElementById("main-content-scroll-container");
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const nextTop = container.scrollTop + targetTop - containerTop - 12;

    container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  };

  return (
    <div className="table-crud-form__advanced-layout">
      <nav className="table-crud-form__anchor" aria-label="大型表单分区">
        {sectionNames.map((item) => (
          <button key={item} type="button" onClick={() => scrollToSection(item)}>
            {item}
          </button>
        ))}
      </nav>

      <div className="table-crud-form__advanced-main">
        <section className="table-crud-form__section" id="基础信息">
          <div className="table-crud-form__section-head">
            <h2>基础信息</h2>
            <p>复杂表单也先完成识别资源和责任归属的核心字段。</p>
          </div>
          <div className="table-crud-form__grid">
            <Form.Item
              label="资源名称"
              name="name"
              rules={[{ required: true, message: "请输入资源名称" }]}
            >
              <Input className="form-item-box" placeholder="请输入资源名称" />
            </Form.Item>
            <Form.Item
              label="负责人"
              name="owner"
              rules={[{ required: true, message: "请选择负责人" }]}
            >
              <Select className="form-item-box" placeholder="请选择负责人" options={ownerOptions} />
            </Form.Item>
            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: "请选择状态" }]}
            >
              <Select className="form-item-box" options={statusOptions} />
            </Form.Item>
            <Form.Item
              label="区域"
              name="region"
              rules={[{ required: true, message: "请选择区域" }]}
            >
              <Select className="form-item-box" placeholder="请选择区域" options={regionOptions} />
            </Form.Item>
          </div>
        </section>

        <section className="table-crud-form__section" id="运行配置">
          <div className="table-crud-form__section-head">
            <h2>运行配置</h2>
            <p>放置影响资源运行方式的配置，不和基础信息混在一起。</p>
          </div>
          <div className="table-crud-form__grid">
            <Form.Item
              label="优先级"
              name="priority"
              rules={[{ required: true, message: "请选择优先级" }]}
            >
              <Select className="form-item-box" options={priorityOptions} />
            </Form.Item>
            <Form.Item label="生效日期" name="effectiveDate">
              <DatePicker className="form-item-box" placeholder="请选择日期" />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </section>

        <section className="table-crud-form__section" id="资源配置">
          <div className="table-crud-form__section-head">
            <h2>资源配置</h2>
            <p>承载容量和调度相关字段，适合后续替换成更具体的业务资源项。</p>
          </div>
          <div className="table-crud-form__grid">
            <Form.Item
              label="配额"
              name="quota"
              rules={[{ required: true, message: "请输入配额" }]}
            >
              <InputNumber className="form-item-box" min={1} max={16} />
            </Form.Item>
            <Form.Item label="标签" name="tags">
              <Checkbox.Group options={tagOptions} />
            </Form.Item>
          </div>
        </section>

        <section className="table-crud-form__section" id="环境变量">
          <div className="table-crud-form__section-head">
            <h2>环境变量</h2>
            <p>动态列表适合大型表单，不放进默认标准表单打扰常规创建流程。</p>
          </div>
          <ParameterListField
            name="envs"
            label="环境变量声明"
            kind="env"
            tooltip="声明资源运行时需要的环境变量 Key，不在此处填写具体密钥值。"
          />
        </section>

        <section className="table-crud-form__section" id="材料上传">
          <div className="table-crud-form__section-head">
            <h2>材料上传</h2>
            <p>上传配置文件、说明附件或其他与资源创建有关的材料。</p>
          </div>
          <Form.Item label="附件" name="attachment">
            <FileUpload
              readAsFile
              buttonText="选择文件"
              tips="本地读取模式；接入真实接口后可替换为 uploadUrl。"
            />
          </Form.Item>
        </section>

        <section className="table-crud-form__section" id="高级策略">
          <div className="table-crud-form__section-head">
            <h2>高级策略</h2>
            <p>放置说明、边界和维护策略，默认靠后，避免影响主流程。</p>
          </div>
          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 500, message: "描述不能超过 500 个字符" }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              placeholder="请输入资源描述、使用边界或维护说明"
            />
          </Form.Item>
        </section>

        <FormSubmitButton
          submitText="创建资源"
          loading={submitting}
          onCancel={handleCancel}
          extra={
            <button className="table-crud-form__draft-button" type="button">
              保存草稿
            </button>
          }
          sticky
        />
      </div>
    </div>
  );
}
