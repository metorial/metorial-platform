import { Service } from '@lowerdeck/service';
import { getGenesis } from '../lib/genesis';

export type SandboxTenantLimits = {
  maxOpenConnections: number | null;
  ingressBytesPerSecondPerConnection: number | null;
  requestsPer10MinutesPerTenant: number | null;
  requestsPer10MinutesPerMachine: number | null;
};

class SandboxTenantServiceImpl {
  async syncLimits(d: { tenant: { id: string; slug: string }; limits: SandboxTenantLimits }) {
    return await getGenesis().tenant.update({
      tenantId: d.tenant.id,
      tenantSlug: d.tenant.slug,
      ...d.limits
    });
  }
}

export let sandboxTenantService = Service.create(
  'sandboxTenant',
  () => new SandboxTenantServiceImpl()
).build();
