import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { db } from '@mtsrc/agent-tracking-db';
import { RedisClient } from 'bun';
import { env, type AgentTrackingRole } from './env';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import { runHealthChecks, storeHealthCheck, type HealthCheck } from './healthChecks';

let healthPort = 12151;
let checkTimeoutMs = 1500;
let storeGraceMs = 120_000;
let startedAt = Date.now();

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

let listenerPorts: Partial<Record<AgentTrackingRole, number>> = {
  api: env.listeners.apiPort,
  ingest: env.listeners.ingestPort
};

let pingListener = async (port: number) => {
  let response = await fetch(`http://127.0.0.1:${port}/ping`, {
    signal: AbortSignal.timeout(checkTimeoutMs)
  });
  if (!response.ok) throw new Error(`Listener on port ${port} answered ${response.status}`);
};

export let startHealthServer = (roles: Set<AgentTrackingRole>) => {
  if (process.env.NODE_ENV !== 'production') return;

  let ports = [...roles].flatMap(role => {
    let port = listenerPorts[role];
    return port === undefined ? [] : [port];
  });

  let checks: HealthCheck[] = [
    { name: 'postgres', run: () => db.organization.count() },
    { name: 'redis', run: () => redis.ping() },
    ...ports.map(port => ({ name: `listener ${port}`, run: () => pingListener(port) })),
    ...(isStoreConfigured()
      ? [storeHealthCheck({ store: getStore(), startedAt, graceMs: storeGraceMs })]
      : [])
  ];

  Bun.serve({
    fetch: async _ =>
      withTracingSuppressed(async () => {
        let result = await runHealthChecks(checks, checkTimeoutMs);
        if (result.healthy) return new Response('OK');

        console.log('[agent-tracking] health check failed', result.failures);
        return new Response('Service Unavailable', { status: 503 });
      }),
    port: healthPort
  });
};
