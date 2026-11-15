import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  createNetworkLogsClient,
  type NetworkLogsClient,
  type Observation
} from '@metorial-platform-systems/network-logs-client';
import { env } from '../env';

let NETWORK_LOGS_TIMEOUT_MS = 15_000;

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

type ListNetworkLogsInput = {
  tenantId: string;
  enclaveIds?: string[];
  hostnames?: string[];
  ips?: string[];
  from?: string;
  to?: string;
  functionIds?: string[];
  intervalMinutes?: number;
};

let networkLogsClient: NetworkLogsClient | undefined;

let getNetworkLogsClient = () => {
  let endpoint = env.networkLogs.NETWORK_LOGS_URL;
  if (!endpoint) return undefined;

  let secret = env.networkLogs.NETWORK_LOGS_RPC_SECRET;
  networkLogsClient ??= createNetworkLogsClient({
    endpoint,
    timeoutMs: NETWORK_LOGS_TIMEOUT_MS,
    ...(secret
      ? { getSignatureToken: () => secret }
      : { tokenFile: env.networkLogs.NETWORK_LOGS_TOKEN_FILE })
  });

  return networkLogsClient;
};

let presentObservation = (record: Observation): NetworkLogRecord => ({
  bucketStart: new Date(record.bucketStart).toISOString(),
  tenantId: record.tenantId,
  functionId: record.functionId,
  effectiveFunctionId: record.effectiveFunctionId,
  enclaveId: record.enclaveId,
  hostname: record.hostname,
  ip: record.ip,
  port: record.port,
  count: record.count,
  firstSeenAt: new Date(record.firstSeenAt).toISOString(),
  lastSeenAt: new Date(record.lastSeenAt).toISOString()
});

let listObserverLogs = async (observerUrl: string, d: ListNetworkLogsInput) => {
  let url = new URL('/logs', observerUrl);
  url.searchParams.set('tenantId', d.tenantId);
  if (d.from) url.searchParams.set('from', d.from);
  if (d.to) url.searchParams.set('to', d.to);
  if (d.intervalMinutes) url.searchParams.set('intervalMinutes', String(d.intervalMinutes));
  for (let functionId of d.functionIds ?? [])
    url.searchParams.append('functionId[]', functionId);
  for (let enclaveId of d.enclaveIds ?? []) url.searchParams.append('enclaveId[]', enclaveId);
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
};

class networkLogServiceImpl {
  async listNetworkLogs(d: ListNetworkLogsInput): Promise<NetworkLogRecord[]> {
    let client = getNetworkLogsClient();
    if (!client) {
      let observerUrl = env.observer.OBSERVER_QUERY_URL;
      return observerUrl ? await listObserverLogs(observerUrl, d) : [];
    }

    let res = await client.observation
      .list({
        tenantId: d.tenantId,
        enclaveIds: d.enclaveIds,
        functionIds: d.functionIds,
        hostnames: d.hostnames,
        ips: d.ips,
        decision: 'allowed',
        from: d.from ? new Date(d.from) : undefined,
        to: d.to ? new Date(d.to) : undefined,
        intervalMinutes: d.intervalMinutes
      })
      .catch(err => {
        console.warn('Unable to fetch network logs', err);
        throw new ServiceError(
          preconditionFailedError({ message: 'Unable to fetch network logs' })
        );
      });

    return res.records.map(presentObservation);
  }
}

export let networkLogService = Service.create(
  'networkLogService',
  () => new networkLogServiceImpl()
).build();
