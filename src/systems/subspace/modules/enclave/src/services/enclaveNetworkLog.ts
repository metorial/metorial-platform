import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { functionBay, getTenantForFunctionBay } from '../functionBay';

export type EnclaveNetworkLogRecord = {
  object: 'enclave.network_log';
  enclaveId?: string;
  bucketStart: string;
  hostname: string;
  ip: string;
  port: number;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type EnclaveNetworkLogsResponse = {
  object: 'enclave.network_logs';
  enclaveIds: string[];
  records: EnclaveNetworkLogRecord[];
};

let presentNetworkLogRecord = (r: {
  enclaveId?: string;
  bucketStart: string;
  hostname: string;
  ip: string;
  port: number;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
}): EnclaveNetworkLogRecord => ({
  object: 'enclave.network_log',
  enclaveId: r.enclaveId,
  bucketStart: r.bucketStart,
  hostname: r.hostname,
  ip: r.ip,
  port: r.port,
  count: r.count,
  firstSeenAt: r.firstSeenAt,
  lastSeenAt: r.lastSeenAt
});

class enclaveNetworkLogServiceImpl {
  async listNetworkLogs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    enclaveIds?: string[];
    filters: {
      hostnames?: string[];
      ips?: string[];
      from?: string;
      to?: string;
      intervalMinutes?: number;
    };
  }): Promise<EnclaveNetworkLogsResponse> {
    let enclaves = await this.resolveEnclaves(d);

    let backedEnclaves = enclaves.filter(e => e.hasFunctionBayBacking);
    if (backedEnclaves.length === 0) {
      return { object: 'enclave.network_logs', enclaveIds: [], records: [] };
    }

    let fbTenant = await getTenantForFunctionBay(d.tenant);

    let logs = await functionBay.networkLog.list({
      tenantId: fbTenant.id,
      enclaveIds: backedEnclaves.map(e => e.id),
      hostnames: d.filters.hostnames,
      ips: d.filters.ips,
      from: d.filters.from,
      to: d.filters.to,
      intervalMinutes: d.filters.intervalMinutes
    });

    return {
      object: 'enclave.network_logs',
      enclaveIds: backedEnclaves.map(e => e.id),
      records: logs.map(r =>
        presentNetworkLogRecord({
          enclaveId: r.enclaveId,
          bucketStart: r.bucketStart,
          hostname: r.hostname,
          ip: r.ip,
          port: r.port,
          count: r.count,
          firstSeenAt: r.firstSeenAt,
          lastSeenAt: r.lastSeenAt
        })
      )
    };
  }

  private async resolveEnclaves(d: {
    tenant: Tenant;
    environment: Environment;
    enclaveIds?: string[];
  }) {
    if (d.enclaveIds?.length) {
      let enclaves = await db.enclave.findMany({
        where: {
          id: { in: d.enclaveIds },
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        select: { id: true, hasFunctionBayBacking: true }
      });

      if (enclaves.length !== d.enclaveIds.length) {
        let found = new Set(enclaves.map(e => e.id));
        let missing = d.enclaveIds.find(id => !found.has(id));
        throw new ServiceError(notFoundError('enclave', missing!));
      }

      return enclaves;
    }

    return await db.enclave.findMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      },
      select: { id: true, hasFunctionBayBacking: true }
    });
  }
}

export let enclaveNetworkLogService = Service.create(
  'enclaveNetworkLogService',
  () => new enclaveNetworkLogServiceImpl()
).build();
