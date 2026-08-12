/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INTEGRATIONS_API_URLS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
