import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  agentTracking: {
    organization: { upsert: vi.fn() },
    project: { upsert: vi.fn() },
    instance: { upsert: vi.fn() }
  },
  settings: {
    url: 'http://agent-tracking.internal/metorial-agent-tracking' as string | undefined,
    ingestPublicUrl: 'https://ingest.example.com' as string | undefined
  },
  syncEntityAddMany: vi.fn(),
  backfillAdd: vi.fn(),
  reconcileAddManyWithOps: vi.fn()
}));

vi.mock('../src/lib/settings', async importOriginal =>
  (await import('./_mocks')).settingsModule(importOriginal)
);

vi.mock('../src/env', () => ({
  agentTrackingSettings: mocks.settings
}));

vi.mock('@mtsrc/agent-tracking-client-internal', () => ({
  createAgentTrackingClient: () => mocks.agentTracking
}));

vi.mock('../src/queues/syncEntity', () => ({
  syncEntityQueue: { addMany: mocks.syncEntityAddMany }
}));

vi.mock('../src/queues/backfill', () => ({
  backfillOrganizationQueue: { add: mocks.backfillAdd }
}));

vi.mock('../src/queues/syncScope', () => ({ syncScopeQueue: { add: vi.fn() } }));

vi.mock('../src/queues/reconcile', () => ({
  reconcileSingleQueue: { addManyWithOps: mocks.reconcileAddManyWithOps }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForScope: vi.fn() }
}));

import { flagService } from '@metorial/module-flags';
import {
  agentTrackingSyncService,
  assertAgentTrackingEnabled,
  canIssueAgentTrackingKeys,
  getAgentTracking,
  getAgentTrackingIngestPublicUrl,
  isAgentTrackingEnabled,
  isAgentTrackingEnabledForOrganization,
  requireAgentTracking,
  requireIngestUrl
} from '../src/services';

let organization = { id: 'org_1', name: 'Acme' };
let project = { id: 'proj_1', name: 'Production' };
let instance = { id: 'inst_1', name: 'Default' };

describe('agent-tracking-sync public surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.url = 'http://agent-tracking.internal/metorial-agent-tracking';
    mocks.settings.ingestPublicUrl = 'https://ingest.example.com';
  });

  it('hands out the client synchronously', () => {
    expect(isAgentTrackingEnabled()).toBe(true);
    expect(getAgentTracking()).toBe(mocks.agentTracking);
    expect(requireAgentTracking()).toBe(mocks.agentTracking);
  });

  it('gives no client while agent tracking is not configured', () => {
    mocks.settings.url = undefined;

    expect(isAgentTrackingEnabled()).toBe(false);
    expect(getAgentTracking()).toBeNull();
    expect(() => requireAgentTracking()).toThrow(
      expect.objectContaining({
        data: expect.objectContaining({ message: 'Agent tracking is not configured.' })
      })
    );
  });

  it('returns the public ingest URL, or null while it is not set', () => {
    expect(getAgentTrackingIngestPublicUrl()).toBe('https://ingest.example.com');
    expect(requireIngestUrl()).toBe('https://ingest.example.com');

    mocks.settings.ingestPublicUrl = undefined;
    expect(getAgentTrackingIngestPublicUrl()).toBeNull();
    expect(() => requireIngestUrl()).toThrow(
      expect.objectContaining({
        data: expect.objectContaining({ message: 'Agent tracking is not configured.' })
      })
    );
  });

  it('upserts the organization, project and instance scopes in order', async () => {
    await agentTrackingSyncService.upsertInstanceScope({ organization, project, instance });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      {
        ref: 'org_1',
        name: 'Acme'
      },
      undefined
    );
    expect(mocks.agentTracking.project.upsert).toHaveBeenCalledWith(
      {
        organizationId: 'org_1',
        ref: 'proj_1',
        name: 'Production'
      },
      undefined
    );
    expect(mocks.agentTracking.instance.upsert).toHaveBeenCalledWith(
      {
        organizationId: 'org_1',
        projectId: 'proj_1',
        ref: 'inst_1',
        name: 'Default'
      },
      undefined
    );
    expect(mocks.agentTracking.project.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.agentTracking.instance.upsert.mock.invocationCallOrder[0]!
    );
  });

  it('passes call options to every scope upsert', async () => {
    await agentTrackingSyncService.upsertInstanceScope({
      organization,
      project,
      instance,
      callOpts: { timeoutMs: 4_000 }
    });

    for (let upsert of [
      mocks.agentTracking.organization.upsert,
      mocks.agentTracking.project.upsert,
      mocks.agentTracking.instance.upsert
    ]) {
      expect(upsert).toHaveBeenCalledWith(expect.any(Object), { timeoutMs: 4_000 });
    }
  });

  it('enqueues an entity sync for each entity', async () => {
    await agentTrackingSyncService.syncEntities({
      entities: [
        { type: 'consumer', id: 'con_1' },
        { type: 'device', id: 'codv_1' }
      ]
    });

    expect(mocks.syncEntityAddMany).toHaveBeenCalledWith([
      { type: 'consumer', id: 'con_1' },
      { type: 'device', id: 'codv_1' }
    ]);
  });

  it('queues one roster backfill per organization', async () => {
    await agentTrackingSyncService.backfillRoster({ organization });

    expect(mocks.backfillAdd).toHaveBeenCalledWith(
      { organizationId: 'org_1' },
      { id: 'org_1' }
    );
  });

  it('queues a reconcile with a roster backfill once the flag settles and once more after the flag cache', async () => {
    await agentTrackingSyncService.reconcileOrganization({ organization });

    expect(mocks.reconcileAddManyWithOps).toHaveBeenCalledWith([
      {
        data: { organizationId: 'org_1', backfillRoster: true },
        opts: { delay: 60_000, id: 'org_1_reconcile_settled' }
      },
      {
        data: { organizationId: 'org_1', backfillRoster: true },
        opts: { delay: 360_000, id: 'org_1_reconcile_cache_expired' }
      }
    ]);
  });

  it('enables agent tracking for an organization only with the flag and a configured service', async () => {
    let scope = { organization: organization as any, project: project as any };

    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(true);
    expect(await isAgentTrackingEnabledForOrganization(scope)).toBe(true);
    expect(flagService.isFlagEnabledForScope).toHaveBeenCalledWith({
      ...scope,
      flag: 'agent-tracking-enabled'
    });

    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(false);
    expect(await isAgentTrackingEnabledForOrganization(scope)).toBe(false);

    vi.mocked(flagService.isFlagEnabledForScope).mockClear();
    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(true);
    mocks.settings.url = undefined;
    expect(await isAgentTrackingEnabledForOrganization(scope)).toBe(false);
    expect(flagService.isFlagEnabledForScope).not.toHaveBeenCalled();
  });

  it('answers not found for an organization without agent tracking', async () => {
    let scope = { organization: organization as any, project: project as any };

    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(false);
    await expect(assertAgentTrackingEnabled(scope)).rejects.toMatchObject({
      data: { status: 404, code: 'not_found', entity: 'agent_tracking' }
    });
    await expect(
      assertAgentTrackingEnabled({ ...scope, entity: 'agent_tracking.ingest_source' })
    ).rejects.toMatchObject({ data: { status: 404, entity: 'agent_tracking.ingest_source' } });

    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(true);
    await expect(assertAgentTrackingEnabled(scope)).resolves.toBeUndefined();
  });

  it('issues keys only with the flag, a configured service and the public ingest URL', async () => {
    let scope = { organization: organization as any, project: project as any };

    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(true);
    expect(await canIssueAgentTrackingKeys(scope)).toBe(true);

    mocks.settings.ingestPublicUrl = undefined;
    expect(await canIssueAgentTrackingKeys(scope)).toBe(false);

    mocks.settings.ingestPublicUrl = 'https://ingest.example.com';
    vi.mocked(flagService.isFlagEnabledForScope).mockResolvedValue(false);
    expect(await canIssueAgentTrackingKeys(scope)).toBe(false);
  });
});
