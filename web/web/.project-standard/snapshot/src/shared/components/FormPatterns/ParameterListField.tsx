import { DeleteOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { Button, Form, Input, Select, Space } from "antd";
import type { ReactNode } from "react";

import "./ParameterListField.css";

type ParameterListKind = "env" | "input" | "output";

interface ParameterListFieldProps {
  name: string;
  label: string;
  kind: ParameterListKind;
  tooltip?: ReactNode;
  disabled?: boolean;
}

const requiredOptions = [
  { label: "必填", value: false },
  { label: "非必填", value: true }
];

const outputTypeOptions = [
  { label: "普通文本", value: 0 },
  { label: "文件路径", value: 1 }
];

function nameRules(kind: ParameterListKind) {
  if (kind === "env") {
    return [
      { required: true, message: "请输入 Key" },
      { pattern: /^[A-Z0-9_]{1,50}$/, message: "仅支持大写字母、数字、下划线，最长50个字符" }
    ];
  }

  return [
    { required: true, message: "请输入参数名称" },
    {
      pattern: /^[a-z][a-z0-9_]{1,50}$/,
      message: "必须以小写字母开头，仅支持小写字母、数字、下划线，最长50个字符"
    }
  ];
}

function defaultValue(kind: ParameterListKind) {
  if (kind === "output") return { value_type: 1 };
  return { is_optional: false };
}

export function ParameterListField({
  name,
  label,
  kind,
  tooltip,
  disabled = false
}: ParameterListFieldProps) {
  return (
    <Form.Item label={label} tooltip={tooltip}>
      <div className="parameter-list-field">
        <Form.List name={name}>
          {(fields, { add, remove, move }) => (
            <>
              <DragDropContext
                onDragEnd={(result: DropResult) => {
                  const { source, destination } = result;
                  if (!destination || source.index === destination.index) return;
                  move(source.index, destination.index);
                }}
              >
                <Droppable droppableId={`${name}-droppable`}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="parameter-list-field__rows"
                    >
                      {fields.map(({ key, name: fieldName, ...restField }, index) => (
                        <Draggable
                          key={String(key)}
                          draggableId={String(key)}
                          index={index}
                          isDragDisabled={disabled}
                        >
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                            >
                              <div
                                className={[
                                  "parameter-list-field__row",
                                  snapshot.isDragging ? "is-dragging" : ""
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <span
                                  className="parameter-list-field__handle"
                                  aria-hidden
                                  {...dragProvided.dragHandleProps}
                                >
                                  <HolderOutlined />
                                </span>
                                <Form.Item
                                  {...restField}
                                  name={[fieldName, kind === "env" ? "key" : "name"]}
                                  className="parameter-list-field__key"
                                  rules={nameRules(kind)}
                                >
                                  <Input placeholder={kind === "env" ? "请输入Key" : "请输入参数名称"} disabled={disabled} />
                                </Form.Item>

                                {kind !== "output" && (
                                  <Form.Item
                                    {...restField}
                                    name={[fieldName, "is_optional"]}
                                    className="parameter-list-field__required"
                                    rules={[{ required: true, message: "请选择是否必填" }]}
                                  >
                                    <Select options={requiredOptions} placeholder="请选择是否必填" disabled={disabled} />
                                  </Form.Item>
                                )}

                                {kind !== "output" && <span className="parameter-list-field__colon">:</span>}

                                {kind === "output" && (
                                  <>
                                    <Form.Item
                                      {...restField}
                                      name={[fieldName, "path"]}
                                      className="parameter-list-field__path"
                                      rules={[{ required: true, message: "请输入输出路径" }]}
                                    >
                                      <Input placeholder="请输入输出路径" disabled={disabled} />
                                    </Form.Item>
                                    <Form.Item
                                      {...restField}
                                      name={[fieldName, "value_type"]}
                                      className="parameter-list-field__type"
                                      rules={[{ required: true, message: "请选择类型" }]}
                                    >
                                      <Select options={outputTypeOptions} disabled={disabled} />
                                    </Form.Item>
                                  </>
                                )}

                                <Form.Item
                                  {...restField}
                                  name={[fieldName, "description"]}
                                  className="parameter-list-field__desc"
                                  rules={[
                                    { required: true, message: "请输入说明" },
                                    { max: 100, message: "说明不能超过100个字符" }
                                  ]}
                                >
                                  <Input placeholder="说明（必填）" maxLength={100} disabled={disabled} />
                                </Form.Item>

                                {!disabled && (
                                  <Button
                                    type="text"
                                    danger
                                    aria-label="删除参数"
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(fieldName)}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <Form.Item className="parameter-list-field__add">
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add(defaultValue(kind))} disabled={disabled}>
                  添加{label}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </div>
    </Form.Item>
  );
}

export function ParameterListLegend() {
  return (
    <Space size={6} className="parameter-list-field__legend">
      <span>Key</span>
      <span>必填</span>
      <span>说明</span>
    </Space>
  );
}
