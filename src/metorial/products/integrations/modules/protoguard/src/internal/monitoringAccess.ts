import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { flagService } from '@metorial/module-flags';
import { rateLimitService } from '@metorial/module-rate-limit';

let SCOPE_CACHE_TTL_SECONDS = 60;

let getTenantProject = createLocallyCachedFunction({
  getHash: (d: { tenantOid: bigint }) => String(d.tenantOid),
  ttlSeconds: SCOPE_CACHE_TTL_SECONDS,
  provider: async (d: { tenantOid: bigint }) => {
    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: d.tenantOid } });
    let project = await db.project.findUniqueOrThrow({ where: { oid: tenant.projectOid! } });

    return await metorialDb.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { organization: true }
    });
  }
});

class ProtoGuardMonitoringAccessServiceImpl {
  async getAllowedScope(d: { tenantOid: bigint }) {
    let project = await getTenantProject(d);
    let scope = { project, organization: project.organization };
    let allowed = await flagService.isFlagEnabledForScope({
      ...scope,
      flag: 'paid-protoguard'
    });

    return allowed ? scope : null;
  }

  async tryStartScan(d: { tenantOid: bigint }) {
    let scope = await this.getAllowedScope(d);
    if (!scope) return null;

    let result = await rateLimitService.tryConsume({
      ...scope,
      usages: [{ key: 'protoguard.message_scans' }]
    });

    return result.allowed ? scope : null;
  }
}

export let protoGuardMonitoringAccessService = Service.create(
  'protoGuardMonitoringAccess',
  () => new ProtoGuardMonitoringAccessServiceImpl()
).build();
