import { gzipSync } from 'node:zlib';
import type { ContentPolicy, NormalizedRecord } from '@metorial/groundstation-spec';
import type { IngestPrincipal } from '../auth/principal';
import { createTenantKeyDeriver } from '../crypto/keys';
import { createIngestFetch } from '../ingest';
import { createRuntime, setRuntime } from '../runtime';
import { createMemorySink } from '../sink/memory';

export let fixedNow = new Date('2026-06-15T12:00:00.000Z');

export let testPrincipal = (
  overrides: Partial<Omit<IngestPrincipal, 'tenant'>> & {
    tenant?: Partial<IngestPrincipal['tenant']>;
  } = {}
): IngestPrincipal => ({
  tokenId: 'itk_test',
  principalRef: 'user_1',
  contentPolicy: { defaultMode: 'basic' },
  limits: {},
  allowedClients: [],
  allowedChannels: [],
  ...overrides,
  tenant: {
    id: 'gst_tenant_1',
    ref: 'org_1',
    skewBoundSeconds: 300,
    backfillMaxAgeDays: 30,
    hashKeyVersion: 1,
    recordRetentionDays: 90,
    contentRetentionDays: 30,
    contentKeyVersion: 1,
    ...overrides.tenant
  }
});

export type SendOptions = {
  method?: string;
  contentType?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array | null;
  gzip?: boolean;
};

export let createPipeline = (
  principalOverrides: Parameters<typeof testPrincipal>[0] = {},
  options: { maxRecords?: number } = {}
) => {
  let sink = createMemorySink({ maxRecords: options.maxRecords });

  let runtime = createRuntime({
    sink,
    memorySink: sink,
    keys: createTenantKeyDeriver('test-hash-secret'),
    clock: () => fixedNow
  });

  setRuntime(runtime);

  let principal = testPrincipal(principalOverrides);
  let fetch = createIngestFetch(async () => principal);

  let send = (path: string, send: SendOptions = {}) => {
    setRuntime(runtime);

    let raw = send.body ?? '{}';
    let bytes = typeof raw == 'string' ? new TextEncoder().encode(raw) : raw;

    return fetch(
      new Request(`http://localhost${path}`, {
        method: send.method ?? 'POST',
        headers: {
          'content-type': send.contentType ?? 'application/json',
          authorization: 'Bearer test',
          ...(send.gzip ? { 'content-encoding': 'gzip' } : {}),
          ...send.headers
        },
        body: send.body === null ? null : ((send.gzip ? gzipSync(bytes) : bytes) as BodyInit)
      })
    );
  };

  return {
    sink,
    principal,
    send,
    records: (): NormalizedRecord[] => sink.list().map(item => item.record)
  };
};

export let withContentPolicy = (contentPolicy: ContentPolicy) => ({ contentPolicy });

export let ndjson = (...lines: unknown[]) =>
  lines.map(line => (typeof line == 'string' ? line : JSON.stringify(line))).join('\n') + '\n';

export let errorBody = async (response: Response) =>
  (await response.json()) as { code: string; message: string; hint?: string };
