/// <reference types="vite/client" />

interface Window {
  __AIHUB_RUNTIME_CONFIG__?: Partial<import("./src/config/runtimeConfig").RuntimeConfig>;
}
