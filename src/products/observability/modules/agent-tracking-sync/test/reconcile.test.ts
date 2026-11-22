import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/queue', async () => (await import('./_mocks')).queueModule);

vi.mock('@metorial/cron', async () => (await import('./_mocks')).cronModule);

vi.mock('../src/lib/links', async () => (await import('./_mocks')).linksModule);

vi.mock('@metorial/db', () => ({
  db: {
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    project: { findMany: vi.fn() },
    instance: { findMany: vi.fn(), findFirst: vi.fn() },
    consumer: { findMany: vi.fn() },
    consumerDevice: { findMany: vi.fn() },
    mcpClientType: { findMany: vi.fn() },
    consumerDeviceDetection: { findMany: vi.fn() }
  }
}));

vi.mock('../src/lib/client', async () => (await import('./_mocks')).clientModule);

vi.mock('../src/lib/flag', async () => (await import('./_mocks')).flagModule);

vi.mock('../src/queues/syncScope', () => ({
  syncScopeQueue: { add: vi.fn(), addMany: vi.fn() }
}));

vi.mock('../src/queues/backfill', () => ({
  backfillOrganizationQueue: { add: vi.fn() }
}));

import { db } from '@metorial/db';
import {
  reconcileCron,
  reconcileEntitiesQueue,
  reconcileEntitiesQueueProcessor,
  reconcileManyQueue,
  reconcileManyQueueProcessor,
  reconcileScopesQueue,
  reconcileScopesQueueProcessor,
  reconcileSingleQueue,
  reconcileSingleQueueProcessor
} from '../src/queues/reconcile';
import { backfillOrganizationQueue } from '../src/queues/backfill';
import { linksModule, mocks, resetMocks } from './_mocks';
import { syncScopeQueue } from '../src/queues/syncScope';

mocks.agentTracking = {
  organization: { get: vi.fn() },
  entity: { list: vi.fn(), archive: vi.fn() }
};

let linkedAt = new Date();

let matches = (row: any, where: any): boolean =>
  Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (key == 'organization' || value === undefined) return true;
    if (key == 'OR') return value.some((branch: any) => matches(row, branch));
    if (key == 'NOT') return !matches(row, value);
    if (value && typeof value == 'object' && 'is' in value) return row[key] == null;
    if (value && typeof value == 'object' && 'isNot' in value) return row[key] != null;
    if (value && typeof value == 'object' && value.not === null) return row[key] != null;
    if (value && typeof value == 'object') return matches(row[key], value);
    return row?.[key] === value;
  });

let organization = { oid: 1n, id: 'org_1', status: 'active' };

describe('agent-tracking/reconcile', () => {
  beforeEach(() => resetMocks());

  it('the cron does nothing while agent tracking is not configured', async () => {
    mocks.enabled.value = false;

    await (reconcileCron as any).handler();

    expect(reconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('fans out one job per organization and pages on a full page', async () => {
    let page = Array.from({ length: 500 }, (_, index) => ({ id: `org_${index}` }));
    vi.mocked(db.organization.findMany).mockResolvedValue(page as any);

    await (reconcileManyQueueProcessor as any).handler({});

    expect(reconcileSingleQueue.addManyWithOps).toHaveBeenCalledWith(
      expect.arrayContaining([{ data: { organizationId: 'org_0' }, opts: { id: 'org_0' } }])
    );
    expect(reconcileManyQueue.add).toHaveBeenCalledWith({ cursor: 'org_499' }, { delay: 0 });
  });

  it('skips an organization without the agent tracking flag', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    vi.mocked(db.instance.findFirst).mockResolvedValue({ oid: 3n } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(reconcileScopesQueue.addMany).not.toHaveBeenCalled();
    expect(reconcileEntitiesQueue.addMany).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('does nothing when a flag change finds the flag still off', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await (reconcileSingleQueueProcessor as any).handler({
      organizationId: 'org_1',
      backfillRoster: true
    });

    expect(reconcileSingleQueue.add).not.toHaveBeenCalled();
    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('backfills the roster after a flag change even without credentials', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await (reconcileSingleQueueProcessor as any).handler({
      organizationId: 'org_1',
      backfillRoster: true
    });

    expect(db.instance.findFirst).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1' },
      { id: 'org_1' }
    );
  });

  it('archives nothing for an organization without the agent tracking flag', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'user'
    });

    expect(mocks.agentTracking.entity.list).not.toHaveBeenCalled();
    expect(mocks.agentTracking.entity.archive).not.toHaveBeenCalled();
  });

  it('only archives the scope of a deleted organization, and only while it is linked', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted',
      agentTrackingLinkedAt: linkedAt
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(reconcileEntitiesQueue.addMany).not.toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();

    vi.mocked(syncScopeQueue.add).mockClear();
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted',
      agentTrackingLinkedAt: null
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).not.toHaveBeenCalled();
  });

  it('leaves an organization that is not linked to its first use, settings or not', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      agentTrackingLinkedAt: null,
      agentTrackingSettings: { hideIndividuals: true }
    } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(mocks.agentTracking.organization.get).not.toHaveBeenCalled();
    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(reconcileScopesQueue.addMany).toHaveBeenCalled();
  });

  it('leaves a linked organization the service still holds alone', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      agentTrackingLinkedAt: linkedAt
    } as any);
    mocks.agentTracking.organization.get.mockResolvedValue({ id: 'org_1' });

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(mocks.agentTracking.organization.get).toHaveBeenCalledWith({
      organizationId: 'org_1'
    });
    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(linksModule.unlinkOrganizationTree).not.toHaveBeenCalled();
    expect(reconcileScopesQueue.addMany).toHaveBeenCalled();
  });

  it('pushes a linked organization with stored settings again, so a lost push lands within a day', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      agentTrackingLinkedAt: linkedAt,
      agentTrackingSettings: { hideIndividuals: true }
    } as any);
    mocks.agentTracking.organization.get.mockResolvedValue({ id: 'org_1' });

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(syncScopeQueue.add).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(linksModule.unlinkOrganizationTree).not.toHaveBeenCalled();
  });

  it('drops every link of an organization the service lost and leaves it to its next use', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      agentTrackingLinkedAt: linkedAt,
      agentTrackingSettings: { hideIndividuals: true }
    } as any);
    mocks.agentTracking.organization.get.mockResolvedValue(null);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(linksModule.unlinkOrganizationTree).toHaveBeenCalledWith(
      expect.objectContaining({ oid: 1n })
    );
    expect(syncScopeQueue.add).not.toHaveBeenCalled();
    expect(
      vi.mocked(linksModule.unlinkOrganizationTree).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(reconcileScopesQueue.addMany).mock.invocationCallOrder[0]!);
  });

  it.each([
    ['project', () => db.project.findMany],
    ['instance', () => db.instance.findMany]
  ] as const)(
    'queues %s scopes that are linked with stored settings or deleted while linked',
    async (type, findMany) => {
      let rows = [
        { id: 'unlinked', status: 'active' },
        { id: 'unlinked_settings', status: 'active', agentTrackingSettings: {} },
        { id: 'linked', status: 'active', agentTrackingLinkedAt: linkedAt },
        {
          id: 'linked_settings',
          status: 'active',
          agentTrackingLinkedAt: linkedAt,
          agentTrackingSettings: {}
        },
        { id: 'deleted_linked', status: 'deleted', agentTrackingLinkedAt: linkedAt },
        { id: 'deleted_unlinked', status: 'deleted', agentTrackingSettings: {} },
        ...(type == 'instance'
          ? [
              {
                id: 'in_deleted_project',
                status: 'active',
                project: { status: 'deleted' },
                agentTrackingLinkedAt: linkedAt
              }
            ]
          : [])
      ].map(row => ({ project: { status: 'active' }, ...row }));
      vi.mocked(findMany()).mockImplementation((async ({ where }: any) =>
        rows.filter(row => matches(row, where)).map(row => ({ id: row.id }))) as any);

      await (reconcileScopesQueueProcessor as any).handler({ organizationId: 'org_1', type });

      expect(syncScopeQueue.addMany).toHaveBeenCalledWith(
        [
          'linked_settings',
          'deleted_linked',
          ...(type == 'instance' ? ['in_deleted_project'] : [])
        ].map(id => ({ type, id }))
      );
    }
  );

  it('backfills the roster of an organization that holds an active credential', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    vi.mocked(db.instance.findFirst).mockResolvedValue({ oid: 3n } as any);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(db.instance.findFirst).toHaveBeenCalledWith({
      where: {
        organizationOid: 1n,
        OR: [
          { agentTrackingIngestSources: { some: { status: 'active' } } },
          { agentTrackingIngestTokens: { some: { status: 'active' } } }
        ]
      },
      select: { oid: true }
    });
    expect(backfillOrganizationQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1' },
      { id: 'org_1' }
    );
  });

  it('leaves the roster of an organization without credentials to the listeners', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    vi.mocked(db.instance.findFirst).mockResolvedValue(null);

    await (reconcileSingleQueueProcessor as any).handler({ organizationId: 'org_1' });

    expect(reconcileEntitiesQueue.addMany).toHaveBeenCalled();
    expect(backfillOrganizationQueue.add).not.toHaveBeenCalled();
  });

  it('archives synced users whose consumer no longer exists', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.agentTracking.entity.list.mockResolvedValue({
      items: [
        { id: 'gen_1', source: 'metorial.consumer', ref: 'con_live' },
        { id: 'gen_2', source: 'metorial.consumer', ref: 'con_gone' },
        { id: 'gen_3', source: 'vendor.cursor', ref: 'cursor_user' },
        { id: 'gen_4', source: 'customer', ref: null }
      ],
      pagination: { has_more_after: false }
    });
    vi.mocked(db.consumer.findMany).mockResolvedValue([{ id: 'con_live' }] as any);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'user'
    });

    expect(mocks.agentTracking.entity.list).toHaveBeenCalledWith({
      organizationId: 'org_1',
      kinds: ['user'],
      statuses: ['managed', 'discovered'],
      limit: 100,
      after: undefined
    });

    expect(db.consumer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['con_live', 'con_gone'] }, organizationOid: 1n },
      select: { id: true }
    });
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledTimes(1);
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_2'
    });
    expect(reconcileEntitiesQueue.add).not.toHaveBeenCalled();
  });

  it('treats ended devices as gone and continues on the next page', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.agentTracking.entity.list.mockResolvedValue({
      items: [{ id: 'gen_9', source: 'metorial.device', ref: 'codv_ended' }],
      pagination: { has_more_after: true }
    });
    vi.mocked(db.consumerDevice.findMany).mockResolvedValue([]);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'device'
    });

    expect(db.consumerDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' })
      })
    );
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_9'
    });
    expect(reconcileEntitiesQueue.add).toHaveBeenCalledWith(
      { organizationId: 'org_1', kind: 'device', after: 'gen_9' },
      { delay: 0 }
    );
  });

  it('archives agents that only a detection no longer backs', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.agentTracking.entity.list.mockResolvedValue({
      items: [
        { id: 'gen_a', source: 'metorial.client', ref: 'cursor', lastSeenAt: null },
        { id: 'gen_b', source: 'metorial.client', ref: 'ollama', lastSeenAt: null },
        { id: 'gen_c', source: 'metorial.client', ref: 'lm-studio', lastSeenAt: null },
        { id: 'gen_d', source: 'metorial.client', ref: 'goose', lastSeenAt: new Date() }
      ],
      pagination: { has_more_after: false }
    });
    vi.mocked(db.mcpClientType.findMany).mockResolvedValue([{ key: 'cursor' }] as any);
    vi.mocked(db.consumerDeviceDetection.findMany).mockResolvedValue([
      { toolKey: 'ollama', instance: { project: { oid: 2n, id: 'proj_1' } } }
    ] as any);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'agent'
    });

    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledTimes(1);
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_c'
    });
  });

  it('archives detection-only agents while detection is not available', async () => {
    mocks.aiToolDetection.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);
    mocks.agentTracking.entity.list.mockResolvedValue({
      items: [{ id: 'gen_b', source: 'metorial.client', ref: 'ollama', lastSeenAt: null }],
      pagination: { has_more_after: false }
    });
    vi.mocked(db.mcpClientType.findMany).mockResolvedValue([]);
    vi.mocked(db.consumerDeviceDetection.findMany).mockResolvedValue([
      { toolKey: 'ollama', instance: { project: { oid: 2n, id: 'proj_1' } } }
    ] as any);

    await (reconcileEntitiesQueueProcessor as any).handler({
      organizationId: 'org_1',
      kind: 'agent'
    });

    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_b'
    });
  });
});
