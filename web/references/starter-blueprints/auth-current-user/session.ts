const TOKEN_KEY = "token";

export function readToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}
