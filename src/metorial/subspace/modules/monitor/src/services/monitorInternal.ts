import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type Environment,
  type ProtoGuardFilter,
  type Provider,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';

let scopeKey = (d: {
  owner: 'tenant' | 'system';
  tenant?: Pick<Tenant, 'id'> | null;
  environment?: Pick<Environment, 'id'> | null;
  solution?: Pick<Solution, 'id'> | null;
}) =>
  d.owner === 'system'
    ? 'system'
    : ['tenant', d.tenant?.id, d.environment?.id ?? 'any', d.solution?.id ?? 'any'].join(':');

export type UpsertProtoGuardFilterMonitorParams = {
  tenant: Tenant;
  environment: Environment;
  filter: ProtoGuardFilter;
  timestamp?: Date;
};

export type UpsertProviderSpecChangeMonitorParams = {
  tenant: Tenant;
  environment: Environment;
  provider: Provider;
  timestamp?: Date;
};

class monitorInternalServiceImpl {
  async upsertProtoGuardFilterMonitor(d: UpsertProtoGuardFilterMonitorParams) {
    let solution = await getMetorialSolution();
    let key = [
      scopeKey({ ...d, solution, owner: 'tenant' }),
      'protoguard_filter',
      d.filter.key
    ].join(':');

    return await db.monitor.upsert({
      where: { key },
      update: {
        status: 'active'
      },
      create: {
        ...getId('monitor'),
        key,
        name: `Protoguard: ${d.filter.name}`,
        description: d.filter.description,
        target: 'protoguard_filter',
        status: 'active',
        owner: 'tenant',
        protoGuardFilterOid: d.filter.oid,
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        solutionOid: solution.oid,
        firstAlertAt: d.timestamp,
        lastAlertAt: d.timestamp
      }
    });
  }

  async upsertProviderSpecChangeMonitor(d: UpsertProviderSpecChangeMonitorParams) {
    let solution = await getMetorialSolution();
    let key = [scopeKey({ ...d, solution, owner: 'tenant' }), 'schema_change', d.provider.id].join(
      ':'
    );

    return await db.monitor.upsert({
      where: { key },
      update: {
        status: 'active'
      },
      create: {
        ...getId('monitor'),
        key,
        name: `Provider schema changes: ${d.provider.name}`,
        description: `Schema changes detected for ${d.provider.name}.`,
        target: 'schema_change',
        status: 'active',
        owner: 'tenant',
        providerOid: d.provider.oid,
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        solutionOid: solution.oid,
        firstAlertAt: d.timestamp,
        lastAlertAt: d.timestamp
      }
    });
  }
}

export let monitorInternalService = Service.create(
  'monitorInternalService',
  () => new monitorInternalServiceImpl()
).build();
