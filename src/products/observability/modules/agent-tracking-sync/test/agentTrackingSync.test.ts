import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  agentTracking: {
    organization: { upsert: vi.fn() },
    project: { upsert: vi.fn() },
    instance: { upsert: vi.fn() },
    ingestSource: { create: vi.fn() }
  },
  settings: {
    url: 'http://agent-tracking.internal/metorial-agent-tracking' as string | undefined,
    ingestPublicUrl: 'https://ingest.example.com' as string | undefined
  },
  syncEntityAddMany: vi.fn(),
  backfillAdd: vi.fn(),
  reconcileAddManyWithOps: vi.fn()
}));

vi.mock('../src/lib/links', async () => (await import('./_mocks')).linksModule);

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

import { notFoundError, ServiceError } from '@lowerdeck/error';
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
  requireIngestUrl,
  withInstanceScope
} from '../src/services';
import { links, resetLinks } from './_mocks';

let organization = { oid: 1n, id: 'org_1', name: 'Acme' };
let project = { oid: 2n, id: 'proj_1', name: 'Production' };
let instance = { oid: 3n, id: 'inst_1', name: 'Default' };

let scope = { organization, project, instance };

let upserts = () => [
  mocks.agentTracking.organization.upsert,
  mocks.agentTracking.project.upsert,
  mocks.agentTracking.instance.upsert
];

let run = async () => 'done';

let rpcCount = () => upserts().reduce((count, upsert) => count + upsert.mock.calls.length, 0);

describe('agent-tracking-sync public surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLinks();
    for (let upsert of upserts()) {
      upsert.mockImplementation(async (input: { ref: string }) => ({ id: input.ref }));
    }
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

  it('upserts and links the organization, project and instance in order while none is linked', async () => {
    expect(await withInstanceScope(scope, run)).toBe('done');

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      { ref: 'org_1', name: 'Acme' },
      undefined
    );
    expect(mocks.agentTracking.project.upsert).toHaveBeenCalledWith(
      { organizationId: 'org_1', ref: 'proj_1', name: 'Production' },
      undefined
    );
    expect(mocks.agentTracking.instance.upsert).toHaveBeenCalledWith(
      { organizationId: 'org_1', projectId: 'proj_1', ref: 'inst_1', name: 'Default' },
      undefined
    );
    let order = upserts().map(upsert => upsert.mock.invocationCallOrder[0]!);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect([
      links.organization.has(1n),
      links.project.has(2n),
      links.instance.has(3n)
    ]).toEqual([true, true, true]);
  });

  it('makes no call to the service while the instance is linked', async () => {
    links.instance.add(3n);

    expect(await withInstanceScope(scope, run)).toBe('done');
    expect(await withInstanceScope(scope, run)).toBe('done');

    expect(rpcCount()).toBe(0);
  });

  it('upserts only the levels that are not linked yet', async () => {
    links.organization.add(1n);

    await withInstanceScope(scope, run);

    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.project.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.agentTracking.instance.upsert).toHaveBeenCalledTimes(1);

    await withInstanceScope(scope, run);
    expect(rpcCount()).toBe(2);
  });

  it('passes call options to every scope upsert', async () => {
    await withInstanceScope({ ...scope, callOpts: { timeoutMs: 4_000 } }, run);

    for (let upsert of upserts()) {
      expect(upsert).toHaveBeenCalledWith(expect.any(Object), { timeoutMs: 4_000 });
    }
  });

  describe('stale scope repair', () => {
    let linkAll = () => {
      links.organization.add(1n);
      links.project.add(2n);
      links.instance.add(3n);
    };

    it('relinks every level once and repeats the call', async () => {
      linkAll();
      let calls = 0;

      let result = await withInstanceScope(scope, async () => {
        calls++;
        if (calls == 1) throw new ServiceError(notFoundError('instance'));
        return 'done';
      });

      expect(result).toBe('done');
      expect(calls).toBe(2);
      expect(rpcCount()).toBe(3);
      expect([
        links.organization.has(1n),
        links.project.has(2n),
        links.instance.has(3n)
      ]).toEqual([true, true, true]);
    });

    it('re-registers the scopes below an organization the service lost and re-created under the same id', async () => {
      linkAll();
      let remote = {
        organizations: new Set(['org_1']),
        projects: new Set(),
        instances: new Set()
      };
      let register = (into: Set<unknown>) => async (input: { ref: string }) => {
        into.add(input.ref);
        return { id: input.ref };
      };
      mocks.agentTracking.organization.upsert.mockImplementation(
        register(remote.organizations)
      );
      mocks.agentTracking.project.upsert.mockImplementation(register(remote.projects));
      mocks.agentTracking.instance.upsert.mockImplementation(register(remote.instances));
      let calls = 0;

      let result = await withInstanceScope(scope, async () => {
        calls++;
        if (!remote.instances.has(instance.id))
          throw new ServiceError(notFoundError('instance'));
        return 'done';
      });

      expect(result).toBe('done');
      expect(calls).toBe(2);
      expect(remote).toEqual({
        organizations: new Set(['org_1']),
        projects: new Set(['proj_1']),
        instances: new Set(['inst_1'])
      });
      expect([
        links.organization.has(1n),
        links.project.has(2n),
        links.instance.has(3n)
      ]).toEqual([true, true, true]);
    });

    it('drops the links of the whole organization, not only the scope in hand', async () => {
      linkAll();
      links.instance.add(4n);
      let calls = 0;

      await withInstanceScope(scope, async () => {
        calls++;
        if (calls == 1) throw new ServiceError(notFoundError('organization'));
      });

      expect(links.instance.has(4n)).toBe(false);
    });

    it('gives up after one repair, upserting each level at most twice', async () => {
      let lost = new ServiceError(notFoundError('project'));
      mocks.agentTracking.instance.upsert
        .mockRejectedValueOnce(lost)
        .mockRejectedValueOnce(lost);

      await expect(withInstanceScope(scope, run)).rejects.toBe(lost);

      for (let upsert of upserts()) expect(upsert).toHaveBeenCalledTimes(2);
    });

    it('leaves the links alone on a not found that is not about the scope', async () => {
      links.instance.add(3n);
      let missingSession = new ServiceError(notFoundError('session'));
      let run = vi.fn().mockRejectedValue(missingSession);

      await expect(withInstanceScope(scope, run)).rejects.toBe(missingSession);

      expect(run).toHaveBeenCalledTimes(1);
      expect(links.instance.has(3n)).toBe(true);
    });
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
