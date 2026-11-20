import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import * as clientFamilies from '@metorial/module-agent-tracking-sync/src/definitions/clientFamilies';
import { expect, vi } from 'vitest';

export let mocks = {
  agentTracking: {
    ingestSource: { create: vi.fn(), get: vi.fn(), revoke: vi.fn() },
    ingestToken: { create: vi.fn(), revoke: vi.fn() }
  },
  enabled: { value: true },
  flagged: { value: true },
  flagChecks: [] as unknown[],
  settings: {
    ingestPublicUrl: 'https://ingest.example.com' as string | undefined
  },
  afterCommit: [] as (() => unknown)[],
  upsertInstanceScope: vi.fn(),
  backfillRoster: vi.fn(),
  syncEntities: vi.fn(),
  fire: vi.fn()
};

let notConfigured = () =>
  new ServiceError(preconditionFailedError({ message: 'Agent tracking is not configured.' }));

let isEnabledForOrganization = async (d: unknown) => {
  mocks.flagChecks.push(d);
  return mocks.enabled.value && mocks.flagged.value;
};

export let syncModule = {
  ...clientFamilies,
  agentTrackingSyncService: {
    upsertInstanceScope: mocks.upsertInstanceScope,
    backfillRoster: mocks.backfillRoster,
    syncEntities: mocks.syncEntities
  },
  isAgentTrackingEnabled: () => mocks.enabled.value,
  assertAgentTrackingEnabled: async (d: {
    organization: unknown;
    project: unknown;
    entity?: string;
  }) => {
    let enabled = await isEnabledForOrganization({
      organization: d.organization,
      project: d.project
    });
    if (!enabled) throw new ServiceError(notFoundError(d.entity ?? 'agent_tracking'));
  },
  canIssueAgentTrackingKeys: async (d: unknown) =>
    !!mocks.settings.ingestPublicUrl && (await isEnabledForOrganization(d)),
  getAgentTracking: () => (mocks.enabled.value ? mocks.agentTracking : null),
  requireAgentTracking: () => {
    if (!mocks.enabled.value) throw notConfigured();
    return mocks.agentTracking;
  },
  getAgentTrackingIngestPublicUrl: () => mocks.settings.ingestPublicUrl ?? null,
  requireIngestUrl: () => {
    if (!mocks.settings.ingestPublicUrl) throw notConfigured();
    return mocks.settings.ingestPublicUrl;
  },
  ignoreNotFound: (promise: Promise<unknown>) => promise
};

export let fabricModule = { Fabric: { fire: mocks.fire } };

export let dbModule = (db: object, generatedId: string) => ({
  db,
  ID: { generateId: vi.fn(async () => generatedId) },
  withTransaction: vi.fn(async (callback: (db: any) => unknown) => await callback(db)),
  addAfterTransactionHook: vi.fn((hook: () => unknown) => mocks.afterCommit.push(hook))
});

export let organization = { oid: 1n, id: 'org_1', name: 'Acme' };
export let project = { oid: 2n, id: 'proj_1', name: 'Production' };
export let instance = {
  oid: 3n,
  id: 'inst_1',
  name: 'Default',
  organizationOid: 1n,
  organization,
  project
};

export let resetMocks = () => {
  vi.clearAllMocks();
  mocks.enabled.value = true;
  mocks.flagged.value = true;
  mocks.flagChecks.length = 0;
  mocks.settings.ingestPublicUrl = 'https://ingest.example.com';
  mocks.afterCommit = [];
};

// Like the RPC client against an unreachable service: it keeps retrying until the call's
// deadline, two minutes unless the caller passes a shorter one.
export let unreachable = (opts?: { timeoutMs?: number }) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Service unavailable')), opts?.timeoutMs ?? 120_000)
  );

export let settledWithin = async (promise: Promise<unknown>, ms: number) => {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true)
  );

  await vi.advanceTimersByTimeAsync(ms);

  return settled;
};

export let expectServiceError = async (promise: Promise<unknown>, message: string) => {
  await expect(promise).rejects.toMatchObject({ data: { message } });
};
