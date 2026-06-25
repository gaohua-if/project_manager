import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input } from "antd";
import type { KeyboardEvent } from "react";

import "./AcceptanceCriteriaEditor.css";
import type { AcceptanceCriteriaValue } from "./acceptanceCriteriaUtils";

interface AcceptanceCriteriaEditorProps {
  value?: AcceptanceCriteriaValue;
  onChange?: (value: string[]) => void;
  placeholder?: string;
}

export function AcceptanceCriteriaEditor({
  value,
  onChange,
  placeholder = "输入一条可验证的验收标准"
}: AcceptanceCriteriaEditorProps) {
  const rows = Array.isArray(value)
    ? value
    : typeof value === "string" && value
      ? value.split("\n")
      : [];
  const visibleRows = rows.length ? rows : [""];

  const updateRows = (nextRows: string[]) => {
    onChange?.(nextRows.length ? nextRows : [""]);
  };

  const handleChange = (index: number, nextValue: string) => {
    const nextRows = [...visibleRows];
    nextRows[index] = nextValue;
    updateRows(nextRows);
  };

  const addRow = (afterIndex = visibleRows.length - 1) => {
    const nextRows = [...visibleRows];
    nextRows.splice(afterIndex + 1, 0, "");
    updateRows(nextRows);
  };

  const removeRow = (index: number) => {
    const nextRows = visibleRows.filter((_, rowIndex) => rowIndex !== index);
    updateRows(nextRows.length ? nextRows : [""]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addRow(index);
      return;
    }
    if (event.key === "Backspace" && !visibleRows[index] && visibleRows.length > 1) {
      event.preventDefault();
      removeRow(index);
    }
  };

  return (
    <div className="acceptance-criteria-editor">
      <div className="acceptance-criteria-editor__list">
        {visibleRows.map((item, index) => (
          <div className="acceptance-criteria-editor__row" key={index}>
            <span className="acceptance-criteria-editor__index">AC{index + 1}</span>
            <Input
              value={item}
              placeholder={placeholder}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
            <Button
              aria-label={`删除 AC${index + 1}`}
              className="acceptance-criteria-editor__delete"
              disabled={visibleRows.length === 1 && !item}
              icon={<DeleteOutlined />}
              type="text"
              onClick={() => removeRow(index)}
            />
          </div>
        ))}
      </div>
      <Button
        className="acceptance-criteria-editor__add"
        icon={<PlusOutlined />}
        type="dashed"
        onClick={() => addRow()}
      >
        添加验收标准
      </Button>
    </div>
  );
}
