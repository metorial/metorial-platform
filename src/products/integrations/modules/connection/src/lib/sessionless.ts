import { resolveSessionlessMcpEnabled } from '@metorial-subspace/module-tenant/src/lib/sessionlessMcp';

export let isSessionlessMcpEnabled = (tenant: { sessionlessMcpEnabled?: boolean | null }) =>
  resolveSessionlessMcpEnabled(tenant.sessionlessMcpEnabled);
