import type {
  ManagedAgent,
  ManagedMCPBinding,
  ManagedMCPEntry,
  ManagedSkill,
  ManagedSkillRef
} from "../../api/types";

export type AssetTab = "agents" | "skills" | "mcp" | "schedules";

export const AI_ASSETS_HOME = "/ai-assets";
export const AI_ASSETS_TAB_QUERY_PARAM = "tab";

const AI_ASSET_TABS = new Set<AssetTab>(["agents", "skills", "mcp", "schedules"]);

export function isAssetTab(value?: string | null): value is AssetTab {
  return Boolean(value && AI_ASSET_TABS.has(value as AssetTab));
}

export function getAIAssetsTabFromSearch(params: URLSearchParams): AssetTab {
  const tab = params.get(AI_ASSETS_TAB_QUERY_PARAM);
  return isAssetTab(tab) ? tab : "agents";
}

export function aiAssetsPath(tab: AssetTab) {
  const params = new URLSearchParams({ [AI_ASSETS_TAB_QUERY_PARAM]: tab });
  return `${AI_ASSETS_HOME}?${params.toString()}`;
}

export function aiAssetsChildPath(path: string, tab: AssetTab) {
  const params = new URLSearchParams({ [AI_ASSETS_TAB_QUERY_PARAM]: tab });
  return `${path}?${params.toString()}`;
}

export const START_PROMPT_PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
export const REPORT_SYSTEM_MARKER = "AIDA_REPORT_DEFAULT:true";
export const REPORT_AGENT_MARKER = "AIDA_REPORT_AGENT:default";
export const REPORT_MANAGED_AGENT_MARKER = "AIDA_MANAGED_DEFAULT_AGENT:true";
export const REPORT_SYSTEM_SKILL_SLUG = "aida-report";
export const REPORT_SYSTEM_SKILL_VERSION = "1.0.0";
export const REPORT_SYSTEM_MCP_SLUG = "aida-report-mcp";
export const REPORT_SYSTEM_MCP_VERSION = "report-v1";
export const REPORT_SYSTEM_PROMPT_KEYS = new Set([
  "report_type",
  "target_json",
  "period_json",
  "period_start",
  "period_end",
  "scheduled_trigger_at",
  "run_id",
  "mcp_url",
  "credential",
  "credential_slot",
  "AIDA_REPORT_MCP_AUTH"
]);

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

export function isSystemBuiltinSkill(item: Pick<ManagedSkill, "slug" | "version" | "description">) {
  return (
    (item.slug === REPORT_SYSTEM_SKILL_SLUG && item.version === REPORT_SYSTEM_SKILL_VERSION) ||
    Boolean(item.description?.includes(REPORT_SYSTEM_MARKER))
  );
}

export function isSystemBuiltinMCP(
  item: Pick<ManagedMCPEntry, "slug" | "version" | "description">
) {
  return (
    (item.slug === REPORT_SYSTEM_MCP_SLUG && item.version === REPORT_SYSTEM_MCP_VERSION) ||
    Boolean(item.description?.includes(REPORT_SYSTEM_MARKER))
  );
}

export function getSystemBuiltinLabel() {
  return "系统内置";
}

export const isReportSystemSkill = isSystemBuiltinSkill;
export const isReportSystemMCP = isSystemBuiltinMCP;

export function reportAgentMarkerText(agent: ManagedAgent) {
  return [agent.description, agent.instructions, agent.start_prompt_template]
    .filter(Boolean)
    .join("\n");
}

export function isReportAgentAsset(agent: ManagedAgent) {
  if (agent.business_type === "report") return true;
  if (agent.business_type === "generic") return false;
  const text = reportAgentMarkerText(agent);
  return text.includes(REPORT_AGENT_MARKER) && text.includes(REPORT_MANAGED_AGENT_MARKER);
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}
