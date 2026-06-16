const TAG_COLORS = ["blue", "cyan", "geekblue", "purple", "green", "orange", "magenta"] as const;

export function getTagColor(value: string, index = 0) {
  const charTotal = [...value].reduce((total, char) => total + char.charCodeAt(0), index);
  return TAG_COLORS[charTotal % TAG_COLORS.length];
}
