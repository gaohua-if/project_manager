import dayjs from "dayjs";

const DEFAULT_DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

export function formatDateTime(
  value: string | number | Date | null | undefined,
  format = DEFAULT_DATE_TIME_FORMAT
) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(format) : "-";
}

export function formatDate(value: string | number | Date | null | undefined) {
  return formatDateTime(value, DEFAULT_DATE_FORMAT);
}
