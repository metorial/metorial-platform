/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MCP_ENDPOINT_HOST_ALLOWLIST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
