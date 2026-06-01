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

let scopeKey = (d: {
  owner: 'tenant' | 'system';
  tenant?: Pick<Tenant, 'id'> | null;
  environment?: Pick<Environment, 'id'> | null;
  solution?: Pick<Solution, 'id'> | null;
}) =>
  d.owner === 'system'
    ? 'system'
    : ['tenant', d.tenant?.id, d.environment?.id ?? 'any', d.solution?.id ?? 'any'].join(':');

class monitorInternalServiceImpl {
  async upsertProtoGuardFilterMonitor(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    filter: ProtoGuardFilter;
    timestamp?: Date;
  }) {
    let key = [scopeKey({ ...d, owner: 'tenant' }), 'protoguard_filter', d.filter.key].join(
      ':'
    );

    return await db.monitor.upsert({
      where: { key },
      update: {
        status: 'active',
        lastAlertAt: d.timestamp
      },
      create: {
        ...getId('monitor'),
        key,
        name: `ProtoGuard: ${d.filter.name}`,
        description: d.filter.description,
        target: 'protoguard_filter',
        status: 'active',
        owner: 'tenant',
        protoGuardFilterOid: d.filter.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        solutionOid: d.solution.oid,
        firstAlertAt: d.timestamp,
        lastAlertAt: d.timestamp
      }
    });
  }

  async upsertProviderSpecChangeMonitor(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    provider: Provider;
    timestamp?: Date;
  }) {
    let key = [scopeKey({ ...d, owner: 'tenant' }), 'schema_change', d.provider.id].join(':');

    return await db.monitor.upsert({
      where: { key },
      update: {
        status: 'active',
        lastAlertAt: d.timestamp
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
        environmentOid: d.environment.oid,
        solutionOid: d.solution.oid,
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
