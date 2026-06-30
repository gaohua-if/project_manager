import { Checkbox, Empty } from "antd";

import type { ManagedSkill } from "../../api/types";
import { refKey, skillLabel } from "../utils/agentAssets";

import "./ResourcePicker.css";

export function SkillResourcePicker({
  value = [],
  onChange,
  skills
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  skills: ManagedSkill[];
}) {
  const selected = new Set(value);
  if (!skills.length) {
    return <Empty className="ai-assets-resource-empty" description="暂无可绑定 Skill" />;
  }
  return (
    <div className="ai-assets-resource-picker">
      {skills.map((skill) => {
        const key = refKey(skill.owner, skill.slug, skill.version);
        const checked = selected.has(key);
        return (
          <div
            role="button"
            tabIndex={0}
            key={key}
            className={`ai-assets-resource-card${checked ? " is-selected" : ""}`}
            onClick={() => {
              const next = checked ? value.filter((item) => item !== key) : [...value, key];
              onChange?.(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                const next = checked ? value.filter((item) => item !== key) : [...value, key];
                onChange?.(next);
              }
            }}
          >
            <Checkbox checked={checked} />
            <span className="ai-assets-resource-card__body">
              <strong>{skill.name || skill.slug}</strong>
              <span>{skill.description || skillLabel(skill)}</span>
              <em>{skillLabel(skill)}</em>
            </span>
          </div>
        );
      })}
    </div>
  );
}
