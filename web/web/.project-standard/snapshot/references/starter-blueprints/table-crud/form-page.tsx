// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { Alert, Button, Form, Input, InputNumber, Result, Select, Spin, Steps } from "antd";
import type { FormInstance } from "antd/es/form";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { buildCreateSuccessUrl, buildListReturnUrl } from "@/shared/utils/urlQuery";

import type { ResourceFormValues } from "./types";

export type ResourceFormVariant = "simple" | "standard" | "steps" | "advanced";

interface ResourceFormPageProps {
  variant?: ResourceFormVariant;
}

const ownerOptions = ["Platform", "Data", "Algorithm"].map((value) => ({ label: value, value }));
const statusOptions = [
  { label: "Running", value: "running" },
  { label: "Paused", value: "paused" },
  { label: "Failed", value: "failed" },
  { label: "Draft", value: "draft" }
];
const priorityOptions = [
  { label: "High", value: "high" },
  { label: "Normal", value: "normal" },
  { label: "Low", value: "low" }
];
const regionOptions = ["North", "East", "South"].map((value) => ({ label: value, value }));

const stepDefinitions: Array<{
  key: string;
  title: string;
  fields: Array<keyof ResourceFormValues>;
}> = [
  { key: "basic", title: "Basic", fields: ["name", "owner", "region"] },
  { key: "runtime", title: "Runtime", fields: ["status", "priority", "quota"] },
  { key: "extra", title: "Extra", fields: ["description"] }
];

export function ResourceFormPage({ variant = "standard" }: ResourceFormPageProps) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm<ResourceFormValues>();
  const [formError, setFormError] = useState<string>();
  const isEdit = Boolean(id);
  const effectiveVariant = isEdit ? "standard" : variant;
  const backTo = buildListReturnUrl("/resources", location.search);
  const title = isEdit ? "Edit resource" : "Create resource";

  // Replace these placeholders with feature query hooks.
  const detailQuery = {
    data: undefined as { data: ResourceFormValues } | undefined,
    isLoading: false,
    isError: false
  };
  const createMutation = {
    isPending: false,
    mutateAsync: async (values: ResourceFormValues) => {
      void values;
    }
  };
  const updateMutation = {
    isPending: false,
    mutateAsync: async (values: ResourceFormValues) => {
      void values;
    }
  };
  const submitting = createMutation.isPending || updateMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });

  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({
        owner: "Platform",
        status: "running",
        priority: "normal",
        region: "North",
        quota: 1
      });
      markClean();
      return;
    }

    if (detailQuery.data?.data) {
      form.setFieldsValue(detailQuery.data.data);
      markClean();
    }
  }, [detailQuery.data, form, isEdit, markClean]);

  const handleSubmit = async (values: ResourceFormValues) => {
    setFormError(undefined);
    try {
      if (id) await updateMutation.mutateAsync(values);
      else await createMutation.mutateAsync(values);
      markClean();
      navigate(id ? backTo : buildCreateSuccessUrl("/resources", location.search), {
        replace: true
      });
    } catch {
      setFormError("Save failed. Please try again.");
    }
  };

  if (isEdit && detailQuery.isLoading) return <PageSkeleton rows={8} />;
  if (isEdit && detailQuery.isError) {
    return <Result status="404" title="Resource not found" />;
  }

  return (
    <PagePanel
      title={title}
      backTo={backTo}
      onBack={() => confirmLeave(() => navigate(backTo))}
      breadcrumbs={[{ title: "资源管理", path: "/resources" }, { title }]}
    >
      <FormPageWrap
        className={`resource-form-wrap resource-form-wrap--${effectiveVariant}`}
        maxWidth="100%"
        density="cozy"
        card
      >
        <Spin spinning={submitting}>
          {formError && <Alert type="error" showIcon message={formError} />}
          <Form
            form={form}
            labelCol={{ flex: "120px" }}
            labelAlign="left"
            onFinish={handleSubmit}
            onValuesChange={markDirty}
            onFieldsChange={markDirty}
          >
            {effectiveVariant === "simple" && renderSimpleForm(submitting, () => navigate(backTo))}
            {effectiveVariant === "standard" &&
              renderStandardForm(submitting, () => navigate(backTo), isEdit)}
            {effectiveVariant === "advanced" && renderAdvancedForm(submitting, () => navigate(backTo))}
            {effectiveVariant === "steps" && (
              <StepsFormContent form={form} submitting={submitting} onCancel={() => navigate(backTo)} />
            )}
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}

function renderSimpleForm(submitting: boolean, onCancel: () => void) {
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
      <div className="resource-form__grid resource-form__grid--simple">
        {renderBasicFields(["name", "owner", "status"])}
        <Form.Item className="resource-form__full-row" label="Description" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </div>
      <FormSubmitButton submitText="Create resource" loading={submitting} onCancel={onCancel} />
    </>
  );
}

function renderStandardForm(submitting: boolean, onCancel: () => void, isEdit: boolean) {
  return (
    <>
      <div className="resource-form__grid">{renderBasicFields()}</div>
      <FormSubmitButton
        submitText={isEdit ? "Save resource" : "Create resource"}
        loading={submitting}
        onCancel={onCancel}
      />
    </>
  );
}

function renderAdvancedForm(submitting: boolean, onCancel: () => void) {
  return (
    <div className="resource-form__advanced-layout">
      <nav className="resource-form__anchor" aria-label="Form sections">
        {["Basic", "Runtime", "Description"].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`}>
            {item}
          </a>
        ))}
      </nav>
      <div className="resource-form__advanced-main">
        <section id="basic" className="resource-form__section">
          <h2>Basic</h2>
          <div className="resource-form__grid">{renderBasicFields(["name", "owner", "region"])}</div>
        </section>
        <section id="runtime" className="resource-form__section">
          <h2>Runtime</h2>
          <div className="resource-form__grid">{renderBasicFields(["status", "priority", "quota"])}</div>
        </section>
        <section id="description" className="resource-form__section">
          <h2>Description</h2>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={4} />
          </Form.Item>
        </section>
        <FormSubmitButton
          submitText="Create resource"
          loading={submitting}
          onCancel={onCancel}
          sticky
        />
      </div>
    </div>
  );
}

interface RenderStepsFormArgs {
  form: FormInstance<ResourceFormValues>;
  submitting: boolean;
  onCancel: () => void;
}

function StepsFormContent({ form, submitting, onCancel }: RenderStepsFormArgs) {
  const [activeStep, setActiveStep] = useState(0);
  const lastStepIndex = stepDefinitions.length - 1;
  const currentStep = stepDefinitions[activeStep] ?? stepDefinitions[0];

  const moveToStep = async (nextStep: number) => {
    if (nextStep < 0 || nextStep > lastStepIndex) return;
    if (nextStep > activeStep) {
      await form.validateFields(currentStep.fields as string[]);
    }
    setActiveStep(nextStep);
  };

  return (
    <div className="resource-form__steps" data-active-step={activeStep}>
      <Steps
        current={activeStep}
        items={stepDefinitions.map((step, index) => ({
          title: step.title,
          disabled: index > activeStep + 1
        }))}
        onChange={(nextStep) => {
          void moveToStep(nextStep);
        }}
      />

      <div className="resource-form__step-body">
        {stepDefinitions.map((step, index) => (
          <section
            key={step.key}
            className="resource-form__step-panel"
            hidden={activeStep !== index}
            aria-hidden={activeStep !== index}
            data-step-key={step.key}
          >
            {step.key === "basic" && (
              <div className="resource-form__grid">{renderBasicFields(["name", "owner", "region"])}</div>
            )}
            {step.key === "runtime" && (
              <div className="resource-form__grid">
                {renderBasicFields(["status", "priority", "quota"])}
              </div>
            )}
            {step.key === "extra" && (
              <Form.Item label="Description" name="description">
                <Input.TextArea rows={4} />
              </Form.Item>
            )}
          </section>
        ))}
      </div>

      <div className="resource-form__step-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button disabled={activeStep === 0} onClick={() => void moveToStep(activeStep - 1)}>
          Previous
        </Button>
        {activeStep < lastStepIndex ? (
          <Button type="primary" onClick={() => void moveToStep(activeStep + 1)}>
            Next
          </Button>
        ) : (
          <Button type="primary" htmlType="submit" loading={submitting}>
            Create resource
          </Button>
        )}
      </div>
    </div>
  );
}

function renderBasicFields(fields?: Array<keyof ResourceFormValues>) {
  const visible = new Set(fields ?? ["name", "owner", "status", "region", "priority", "quota", "description"]);

  return (
    <>
      {visible.has("name") && (
        <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
          <Input />
        </Form.Item>
      )}
      {visible.has("owner") && (
        <Form.Item label="Owner" name="owner" rules={[{ required: true, message: "Select an owner" }]}>
          <Select options={ownerOptions} />
        </Form.Item>
      )}
      {visible.has("status") && (
        <Form.Item label="Status" name="status" rules={[{ required: true, message: "Select status" }]}>
          <Select options={statusOptions} />
        </Form.Item>
      )}
      {visible.has("region") && (
        <Form.Item label="Region" name="region" rules={[{ required: true, message: "Select region" }]}>
          <Select options={regionOptions} />
        </Form.Item>
      )}
      {visible.has("priority") && (
        <Form.Item label="Priority" name="priority" rules={[{ required: true, message: "Select priority" }]}>
          <Select options={priorityOptions} />
        </Form.Item>
      )}
      {visible.has("quota") && (
        <Form.Item label="Quota" name="quota" rules={[{ required: true, message: "Enter quota" }]}>
          <InputNumber min={1} max={100} />
        </Form.Item>
      )}
      {visible.has("description") && (
        <Form.Item className="resource-form__full-row" label="Description" name="description">
          <Input.TextArea rows={4} />
        </Form.Item>
      )}
    </>
  );
}
