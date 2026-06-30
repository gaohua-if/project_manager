import type {
  ManagedAgent,
  ManagedMCPBinding,
  ManagedScope,
  ManagedSkillRef
} from "../../api/types";

export const SCOPE_OPTIONS: Array<{ label: string; value: ManagedScope }> = [
  { label: "我的", value: "mine" },
  { label: "公开", value: "public" },
  { label: "全部", value: "all" }
];

export const START_PROMPT_PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractPromptVariables(template?: string) {
  const seen = new Set<string>();
  const keys: string[] = [];
  if (!template) return keys;
  for (const match of template.matchAll(START_PROMPT_PLACEHOLDER_RE)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

export function renderPromptPreview(template: string, values: Record<string, string>) {
  return template.replace(START_PROMPT_PLACEHOLDER_RE, (match, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : match;
  });
}

export function refKey(owner: string | undefined, slug: string, version: string) {
  return [owner || "", slug, version].join("/");
}

export function parseRefKey(value: string): ManagedSkillRef {
  const [owner, slug, version] = value.split("/");
  return { owner: owner || undefined, slug, version };
}

export function parseMCPBindingKey(value: string): ManagedMCPBinding {
  return parseRefKey(value);
}

export function skillLabel(item: ManagedSkillRef) {
  return `${item.slug}@${item.version}`;
}

export function mcpLabel(item: ManagedMCPBinding) {
  return `${item.slug}@${item.version}`;
}

export function currentSkillKeys(agent?: ManagedAgent | null) {
  return agent?.skills?.map((item) => refKey(item.owner, item.slug, item.version)) ?? [];
}

export function currentMCPKeys(agent?: ManagedAgent | null) {
  return agent?.mcp_bindings?.map((item) => refKey(item.owner, item.slug, item.version)) ?? [];
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}
