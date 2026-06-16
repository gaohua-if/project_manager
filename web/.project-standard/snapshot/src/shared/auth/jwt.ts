interface JwtPayload {
  uid?: string | number;
  exp?: number;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("登录凭证格式无效");
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
  } catch {
    throw new Error("登录凭证无法解析");
  }
}

export function getTokenUserId(token: string): string {
  const payload = readJwtPayload(token);
  const userId = payload.uid;

  if ((typeof userId !== "string" && typeof userId !== "number") || String(userId).trim() === "") {
    throw new Error("登录凭证缺少用户标识");
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    throw new Error("登录凭证已过期");
  }

  return String(userId);
}
