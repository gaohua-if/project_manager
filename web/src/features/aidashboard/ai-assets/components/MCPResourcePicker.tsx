import { Checkbox, Empty } from "antd";

import type { ManagedMCPEntry } from "../../api/types";
import {
  getSystemBuiltinLabel,
  isSystemBuiltinMCP,
  mcpLabel,
  refKey
} from "../utils/agentAssets";

import "./ResourcePicker.css";

export function MCPResourcePicker({
  value = [],
  onChange,
  entries
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  entries: ManagedMCPEntry[];
}) {
  const selected = new Set(value);
  if (!entries.length) {
    return <Empty className="ai-assets-resource-empty" description="暂无可绑定 MCP Server" />;
  }
  return (
    <div className="ai-assets-resource-picker">
      {entries.map((entry) => {
        const key = refKey(entry.owner, entry.slug, entry.version);
        const ownerlessKey = refKey(undefined, entry.slug, entry.version);
        const removableKeys = new Set([key, ownerlessKey]);
        const checked = selected.has(key) || selected.has(ownerlessKey);
        const title = `${entry.name || entry.slug}${isSystemBuiltinMCP(entry) ? `（${getSystemBuiltinLabel()}）` : ""}`;
        return (
          <div
            role="button"
            tabIndex={0}
            key={key}
            className={`ai-assets-resource-card${checked ? " is-selected" : ""}`}
            onClick={() => {
              const next = checked ? value.filter((item) => !removableKeys.has(item)) : [...value, key];
              onChange?.(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                const next = checked ? value.filter((item) => !removableKeys.has(item)) : [...value, key];
                onChange?.(next);
              }
            }}
          >
            <Checkbox checked={checked} />
            <span className="ai-assets-resource-card__body">
              <strong>{title}</strong>
              <span>{entry.description || entry.url || entry.command || "-"}</span>
              <em>
                {mcpLabel(entry)}
                {entry.requires_credential ? " · 需要凭据" : ""}
              </em>
            </span>
          </div>
        );
      })}
    </div>
  );
}
