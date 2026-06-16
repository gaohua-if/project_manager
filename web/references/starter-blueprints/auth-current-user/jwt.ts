interface JwtPayload {
  uid?: string | number;
  exp?: number;
}

export function getTokenUserId(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const payload = JSON.parse(window.atob(padded)) as JwtPayload;

  if (payload.uid === undefined || payload.uid === null || String(payload.uid).trim() === "") {
    throw new Error("Token user id is missing");
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    throw new Error("Token has expired");
  }
  return String(payload.uid);
}
