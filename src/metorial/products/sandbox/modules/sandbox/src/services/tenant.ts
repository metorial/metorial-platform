import { Service } from '@lowerdeck/service';
import { db, ID, type Instance, type SandboxRegion } from '@metorial/db';
import {
  getRegional,
  sandboxTenantInclude,
  type SandboxTenantWithRegion
} from '../lib/regional';
import { getRegionClient } from '../lib/regions';

export type SandboxTenantLimits = {
  maxOpenConnections: number | null;
  ingressBytesPerSecondPerConnection: number | null;
  requestsPer10MinutesPerTenant: number | null;
  requestsPer10MinutesPerMachine: number | null;
};

class SandboxTenantServiceImpl {
  async ensure(d: { instance: Instance; region: SandboxRegion }) {
    let find = () =>
      db.sandboxTenant.findFirst({
        where: { projectOid: d.instance.projectOid, regionOid: d.region.oid },
        include: sandboxTenantInclude
      });

    let existing = await find();
    if (existing) return existing;

    let project = await db.project.findFirstOrThrow({ where: { oid: d.instance.projectOid } });

    let id = await ID.generateId('sandboxTenant');
    let genesisTenant = await getRegionClient(d.region.id).tenant.update({
      tenantId: id,
      tenantSlug: project.slug
    });

    try {
      return await db.sandboxTenant.create({
        data: {
          id,
          slug: genesisTenant.slug,
          regionOid: d.region.oid,
          organizationOid: d.instance.organizationOid,
          projectOid: d.instance.projectOid
        },
        include: sandboxTenantInclude
      });
    } catch (err) {
      let concurrent = await find();
      if (concurrent) return concurrent;

      throw err;
    }
  }

  async syncLimits(d: { tenant: SandboxTenantWithRegion; limits: SandboxTenantLimits }) {
    let { genesis, tenantId } = getRegional(d.tenant);

    return await genesis.tenant.update({
      tenantId,
      tenantSlug: d.tenant.slug,
      ...d.limits
    });
  }
}

export let sandboxTenantService = Service.create(
  'sandboxTenantService',
  () => new SandboxTenantServiceImpl()
).build();
