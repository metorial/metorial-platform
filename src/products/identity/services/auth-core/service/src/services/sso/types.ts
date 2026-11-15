import type { SsoConnection, SsoDirectory, SsoTenant } from '../../../prisma/generated/client';

export type SsoDirectoryWithApp = SsoDirectory & {
  connection?: SsoConnection & {
    tenant?: SsoTenant;
  };
};
