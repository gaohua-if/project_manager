export interface RuntimeConfig {
  apiBaseUrl: string;
  authApiBaseUrl: string;
  userApiBaseUrl: string;
  appTitle: string;
  enableMock: boolean;
  enableDebug: boolean;
}

export const defaultRuntimeConfig: RuntimeConfig = {
  apiBaseUrl: "/api",
  authApiBaseUrl: "/api/v1",
  userApiBaseUrl: "/api/v1",
  appTitle: "AIHub Platform",
  enableMock: true,
  enableDebug: true
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    ...defaultRuntimeConfig,
    ...(window.__AIHUB_RUNTIME_CONFIG__ ?? {})
  };
}

export const runtimeConfig = getRuntimeConfig();
