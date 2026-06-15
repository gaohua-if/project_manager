export function AlertBanner({
  level,
  children,
}: {
  level: "danger" | "warning" | "info"
  children: React.ReactNode
}) {
  const styles: Record<string, string> = {
    danger: "bg-danger/15 border-danger/40 text-danger",
    warning: "bg-warning/15 border-warning/40 text-warning",
    info: "bg-info/15 border-info/40 text-info",
  }
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${styles[level]}`}>{children}</div>
  )
}
