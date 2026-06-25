export type AcceptanceCriteriaValue = string[] | string | undefined;

export function normalizeAcceptanceCriteria(value: AcceptanceCriteriaValue): string[] {
  const items = Array.isArray(value) ? value : (value ?? "").split("\n");
  return items.map((item) => item.replace(/^\s*(AC\s*)?\d+[.、:：]?\s*/i, "").trim()).filter(Boolean);
}
