import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { functionBay, getTenantForFunctionBay } from '../functionBay';

export type EnclaveNetworkLogDirection = 'ingress' | 'egress';

export type EnclaveNetworkLogRecord = {
  object: 'enclave.network_log';
  direction: EnclaveNetworkLogDirection;
  enclaveId?: string;
  bucketStart: string;
  hostname: string;
  ip: string;
  port: number;
  count: number;
  result?: 'allowed' | 'denied';
  firstSeenAt: string;
  lastSeenAt: string;
};

export type EnclaveNetworkLogsResponse = {
  object: 'enclave.network_logs';
  direction: EnclaveNetworkLogDirection;
  enclaveIds: string[];
  records: EnclaveNetworkLogRecord[];
};

type ListNetworkLogsParams = {
  direction: EnclaveNetworkLogDirection;
  enclaveIds?: string[];
  filters: {
    hostnames?: string[];
    ips?: string[];
    from?: string;
    to?: string;
    intervalMinutes?: number;
  };
};

let presentNetworkLogRecord = (r: {
  direction: EnclaveNetworkLogDirection;
  enclaveId?: string;
  bucketStart: string;
  hostname: string;
  ip: string;
  port: number;
  count: number;
  result?: 'allowed' | 'denied';
  firstSeenAt: string;
  lastSeenAt: string;
}): EnclaveNetworkLogRecord => ({
  object: 'enclave.network_log',
  direction: r.direction,
  enclaveId: r.enclaveId,
  bucketStart: r.bucketStart,
  hostname: r.hostname,
  ip: r.ip,
  port: r.port,
  count: r.count,
  result: r.result,
  firstSeenAt: r.firstSeenAt,
  lastSeenAt: r.lastSeenAt
});

let getBucketStart = (date: Date, intervalMinutes: number) => {
  let intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs).toISOString();
};

class enclaveNetworkLogServiceImpl {
  async listNetworkLogs(d: MetorialFacing<ListNetworkLogsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listNetworkLogsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listNetworkLogsInternal(
    d: { tenant: Tenant; environment: Environment } & ListNetworkLogsParams
  ): Promise<EnclaveNetworkLogsResponse> {
    if (d.direction === 'ingress') {
      return await this.listIngressNetworkLogs(d);
    }

    return await this.listEgressNetworkLogs(d);
  }

  private async listEgressNetworkLogs(d: {
    tenant: Tenant;
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
      return {
        object: 'enclave.network_logs',
        direction: 'egress',
        enclaveIds: [],
        records: []
      };
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
      direction: 'egress',
      enclaveIds: backedEnclaves.map(e => e.id),
      records: logs.map(r =>
        presentNetworkLogRecord({
          direction: 'egress',
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

  private async listIngressNetworkLogs(d: {
    tenant: Tenant;
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
    if (enclaves.length === 0) {
      return {
        object: 'enclave.network_logs',
        direction: 'ingress',
        enclaveIds: [],
        records: []
      };
    }

    let solution = await getMetorialSolution();
    let enclaveIdsByOid = new Map(enclaves.map(e => [e.oid, e.id]));
    let from = d.filters.from ? new Date(d.filters.from) : undefined;
    let to = d.filters.to ? new Date(d.filters.to) : undefined;

    let logs = await db.enclaveIngressNetworkLog.findMany({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        solutionOid: solution.oid,
        enclaveOid: { in: enclaves.map(e => e.oid) },
        hostname: d.filters.hostnames?.length ? { in: d.filters.hostnames } : undefined,
        sourceIp: d.filters.ips?.length ? { in: d.filters.ips } : undefined,
        bucketStart:
          from || to
            ? {
                gte: from,
                lte: to
              }
            : undefined
      },
      orderBy: { bucketStart: 'desc' },
      take: 5000
    });

    let intervalMinutes = d.filters.intervalMinutes ?? 5;
    let grouped = new Map<
      string,
      {
        enclaveId?: string;
        bucketStart: string;
        hostname: string;
        ip: string;
        port: number;
        result: 'allowed' | 'denied';
        count: number;
        firstSeenAt: Date;
        lastSeenAt: Date;
      }
    >();

    for (let log of logs) {
      let bucketStart = getBucketStart(log.bucketStart, intervalMinutes);
      let enclaveId = enclaveIdsByOid.get(log.enclaveOid);
      let key = [
        enclaveId,
        bucketStart,
        log.hostname,
        log.sourceIp,
        log.port,
        log.result
      ].join('\0');

      let existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          enclaveId,
          bucketStart,
          hostname: log.hostname,
          ip: log.sourceIp,
          port: log.port,
          result: log.result,
          count: log.count,
          firstSeenAt: log.firstSeenAt,
          lastSeenAt: log.lastSeenAt
        });
        continue;
      }

      existing.count += log.count;
      if (log.firstSeenAt < existing.firstSeenAt) existing.firstSeenAt = log.firstSeenAt;
      if (log.lastSeenAt > existing.lastSeenAt) existing.lastSeenAt = log.lastSeenAt;
    }

    return {
      object: 'enclave.network_logs',
      direction: 'ingress',
      enclaveIds: enclaves.map(e => e.id),
      records: [...grouped.values()].map(record =>
        presentNetworkLogRecord({
          direction: 'ingress',
          enclaveId: record.enclaveId,
          bucketStart: record.bucketStart,
          hostname: record.hostname,
          ip: record.ip,
          port: record.port,
          count: record.count,
          result: record.result,
          firstSeenAt: record.firstSeenAt.toISOString(),
          lastSeenAt: record.lastSeenAt.toISOString()
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
        select: { oid: true, id: true, hasFunctionBayBacking: true },
        take: 500
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
      select: { oid: true, id: true, hasFunctionBayBacking: true },
      take: 500
    });
  }
}

export let enclaveNetworkLogService = Service.create(
  'enclaveNetworkLogService',
  () => new enclaveNetworkLogServiceImpl()
).build();
