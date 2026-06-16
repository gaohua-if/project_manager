export function getNumberParam(params: URLSearchParams, key: string, fallback: number) {
  const value = Number(params.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function setOrDeleteParam(params: URLSearchParams, key: string, value?: string | number) {
  if (value === undefined || value === null || value === "") {
    params.delete(key);
  } else {
    params.set(key, String(value));
  }
}

export function appendSearch(path: string, search: string | URLSearchParams) {
  const query = typeof search === "string" ? search.replace(/^\?/, "") : search.toString();
  return query ? `${path}?${query}` : path;
}

export function buildListReturnUrl(path: string, search: string) {
  return appendSearch(path, search);
}

export function buildCreateSuccessUrl(path: string, search: string) {
  const params = new URLSearchParams(search);
  params.set("page_num", "1");
  return appendSearch(path, params);
}
