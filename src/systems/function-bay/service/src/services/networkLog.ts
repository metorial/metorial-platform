import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { env } from '../env';

export type NetworkLogRecord = {
  bucketStart: string;
  tenantId: string;
  functionId: string;
  effectiveFunctionId?: string;
  enclaveId?: string;
  hostname: string;
  ip: string;
  port: number;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

class networkLogServiceImpl {
  async listNetworkLogs(d: {
    tenantId: string;
    enclaveIds?: string[];
    hostnames?: string[];
    ips?: string[];
    from?: string;
    to?: string;
    functionIds?: string[];
    intervalMinutes?: number;
  }) {
    if (!env.observer.OBSERVER_QUERY_URL) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Observer query URL is not configured' })
      );
    }

    let url = new URL('/logs', env.observer.OBSERVER_QUERY_URL);
    url.searchParams.set('tenantId', d.tenantId);
    if (d.from) url.searchParams.set('from', d.from);
    if (d.to) url.searchParams.set('to', d.to);
    if (d.intervalMinutes) url.searchParams.set('intervalMinutes', String(d.intervalMinutes));
    for (let functionId of d.functionIds ?? [])
      url.searchParams.append('functionId[]', functionId);
    for (let enclaveId of d.enclaveIds ?? [])
      url.searchParams.append('enclaveId[]', enclaveId);
    for (let hostname of d.hostnames ?? []) url.searchParams.append('hostname[]', hostname);
    for (let ip of d.ips ?? []) url.searchParams.append('ip[]', ip);

    let res = await fetch(url);
    if (!res.ok) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Unable to fetch network logs' })
      );
    }

    let body = (await res.json()) as { records?: NetworkLogRecord[] };
    return body.records ?? [];
  }
}

export let networkLogService = Service.create(
  'networkLogService',
  () => new networkLogServiceImpl()
).build();
