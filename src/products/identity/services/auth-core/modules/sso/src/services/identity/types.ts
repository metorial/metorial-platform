import type { SsoConnection, SsoDirectory, SsoTenant } from '@mtsrc/auth-core-db';

export type SsoDirectoryWithApp = SsoDirectory & {
  connection?: SsoConnection & {
    tenant?: SsoTenant;
  };
};
