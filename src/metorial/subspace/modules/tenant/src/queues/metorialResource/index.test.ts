import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  cronConfig: undefined as { name: string; redisUrl: string; cron: string } | undefined,
  cronHandler: undefined as (() => Promise<void>) | undefined,
  organizationFindMany: vi.fn(),
  organizationFind: vi.fn(),
  organizationActorFindMany: vi.fn(),
  organizationMemberFindMany: vi.fn(),
  consumerFindMany: vi.fn(),
  reconcileOrganization: vi.fn(),
  queues: new Map<
    string,
    {
      add: ReturnType<typeof vi.fn>;
      addManyWithOps: ReturnType<typeof vi.fn>;
      handler?: (data: any) => Promise<void>;
    }
  >()
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://test' } }
}));

vi.mock('../../lib/metorialDb', () => ({
  metorialDb: {
    organization: {
      findMany: mocks.organizationFindMany,
      findUniqueOrThrow: mocks.organizationFind
    },
    project: { findUniqueOrThrow: vi.fn() },
    instance: { findUniqueOrThrow: vi.fn() },
    organizationActor: {
      findUniqueOrThrow: vi.fn(),
      findMany: mocks.organizationActorFindMany
    },
    organizationMember: {
      findUniqueOrThrow: vi.fn(),
      findMany: mocks.organizationMemberFindMany
    },
    consumer: {
      findUniqueOrThrow: vi.fn(),
      findMany: mocks.consumerFindMany
    },
    instanceConsumer: { findUniqueOrThrow: vi.fn() },
    consumerProfile: { findUniqueOrThrow: vi.fn() }
  }
}));

vi.mock('../../services/metorialResource', () => ({
  metorialResourceService: {
    syncOrganization: vi.fn(),
    syncProject: vi.fn(),
    syncInstance: vi.fn(),
    syncOrganizationActor: vi.fn(),
    syncOrganizationMember: vi.fn(),
    syncConsumerGraph: vi.fn(),
    syncInstanceConsumer: vi.fn(),
    syncConsumerProfile: vi.fn(),
    deleteConsumer: vi.fn(),
    reconcileOrganization: mocks.reconcileOrganization
  }
}));

vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn((config, handler) => {
    mocks.cronConfig = config;
    mocks.cronHandler = handler;
    return { handler };
  })
}));

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn(processors => processors),
  createQueue: vi.fn(({ name }: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      handler: undefined as ((data: any) => Promise<void>) | undefined
    };
    mocks.queues.set(name, queue);
    return {
      add: queue.add,
      addManyWithOps: queue.addManyWithOps,
      process: (handler: (data: any) => Promise<void>) => {
        queue.handler = handler;
        return { handler };
      }
    };
  })
}));

import './index';

describe('Metorial resource reconciler', () => {
  beforeEach(() => {
    mocks.organizationFindMany.mockReset();
    mocks.organizationFind.mockReset();
    mocks.organizationActorFindMany.mockReset();
    mocks.organizationMemberFindMany.mockReset();
    mocks.consumerFindMany.mockReset();
    mocks.reconcileOrganization.mockReset();
    for (let queue of mocks.queues.values()) {
      queue.add.mockClear();
      queue.addManyWithOps.mockClear();
    }
  });

  it('runs hourly and starts a deduplicated search', async () => {
    expect(mocks.cronConfig).toEqual({
      name: 'sub/ten/metorial/reconcile/cron',
      redisUrl: 'redis://test',
      cron: '0 * * * *'
    });

    await mocks.cronHandler!();

    expect(mocks.queues.get('sub/ten/metorial/reconcile/search')?.add).toHaveBeenCalledWith(
      {},
      { id: 'subspace-metorial-resource-search' }
    );
  });

  it('pages by oid and enqueues hierarchical organization reconciliation', async () => {
    mocks.organizationFindMany.mockResolvedValueOnce([
      { oid: 11n, id: 'org_11' },
      { oid: 12n, id: 'org_12' }
    ]);

    await mocks.queues.get('sub/ten/metorial/reconcile/search')!.handler!({
      cursor: '10'
    });

    expect(mocks.organizationFindMany).toHaveBeenCalledWith({
      where: { oid: { gt: 10n } },
      orderBy: { oid: 'asc' },
      take: 500,
      select: { oid: true, id: true }
    });
    expect(
      mocks.queues.get('sub/ten/metorial/reconcile/org')?.addManyWithOps
    ).toHaveBeenCalledWith([
      {
        data: { organizationId: 'org_11' },
        opts: { id: 'subspace-metorial-org:org_11' }
      },
      {
        data: { organizationId: 'org_12' },
        opts: { id: 'subspace-metorial-org:org_12' }
      }
    ]);
    expect(mocks.queues.get('sub/ten/metorial/reconcile/search')?.add).toHaveBeenCalledWith({
      cursor: '12'
    });
  });

  it('starts paginated identity and consumer reconciliation after core resources', async () => {
    await mocks.queues.get('sub/ten/metorial/reconcile/org')!.handler!({
      organizationId: 'org_1'
    });

    expect(mocks.reconcileOrganization).toHaveBeenCalledWith('org_1');
    expect(
      mocks.queues.get('sub/ten/metorial/reconcile/identitySearch')?.add
    ).toHaveBeenNthCalledWith(
      1,
      { organizationId: 'org_1', resource: 'actor' },
      { id: 'subspace-metorial-actors:org_1:start' }
    );
    expect(
      mocks.queues.get('sub/ten/metorial/reconcile/identitySearch')?.add
    ).toHaveBeenNthCalledWith(
      2,
      { organizationId: 'org_1', resource: 'member' },
      { id: 'subspace-metorial-members:org_1:start' }
    );
    expect(
      mocks.queues.get('sub/ten/metorial/reconcile/consumerSearch')?.add
    ).toHaveBeenCalledWith(
      { organizationId: 'org_1' },
      { id: 'subspace-metorial-consumers:org_1:start' }
    );
  });

  it('pages an organization consumer graph with stable job ids', async () => {
    mocks.organizationFind.mockResolvedValue({ oid: 1n });
    mocks.consumerFindMany.mockResolvedValue([
      { oid: 21n, id: 'con_21' },
      { oid: 22n, id: 'con_22' }
    ]);

    await mocks.queues.get('sub/ten/metorial/reconcile/consumerSearch')!.handler!({
      organizationId: 'org_1',
      cursor: '20'
    });

    expect(mocks.consumerFindMany).toHaveBeenCalledWith({
      where: {
        organizationOid: 1n,
        oid: { gt: 20n }
      },
      orderBy: { oid: 'asc' },
      take: 500,
      select: { oid: true, id: true }
    });
    expect(mocks.queues.get('sub/ten/metorial/consumer')?.addManyWithOps).toHaveBeenCalledWith(
      [
        {
          data: { consumerId: 'con_21' },
          opts: { id: 'subspace-metorial-consumer:con_21' }
        },
        {
          data: { consumerId: 'con_22' },
          opts: { id: 'subspace-metorial-consumer:con_22' }
        }
      ]
    );
    expect(
      mocks.queues.get('sub/ten/metorial/reconcile/consumerSearch')?.add
    ).toHaveBeenCalledWith(
      { organizationId: 'org_1', cursor: '22' },
      { id: 'subspace-metorial-consumers:org_1:22' }
    );
  });

  it('pages organization identities independently with stable job ids', async () => {
    mocks.organizationFind.mockResolvedValue({ oid: 1n });
    mocks.organizationActorFindMany.mockResolvedValue([{ oid: 31n, id: 'oac_31' }]);

    await mocks.queues.get('sub/ten/metorial/reconcile/identitySearch')!.handler!({
      organizationId: 'org_1',
      resource: 'actor',
      cursor: '30'
    });

    expect(mocks.organizationActorFindMany).toHaveBeenCalledWith({
      where: {
        organizationOid: 1n,
        oid: { gt: 30n }
      },
      orderBy: { oid: 'asc' },
      take: 500,
      select: { oid: true, id: true }
    });
    expect(mocks.queues.get('sub/ten/metorial/orgActor')?.addManyWithOps).toHaveBeenCalledWith(
      [
        {
          data: { organizationActorId: 'oac_31' },
          opts: { id: 'subspace-metorial-actor:oac_31' }
        }
      ]
    );
    expect(
      mocks.queues.get('sub/ten/metorial/reconcile/identitySearch')?.add
    ).toHaveBeenCalledWith(
      { organizationId: 'org_1', resource: 'actor', cursor: '31' },
      { id: 'subspace-metorial-actors:org_1:31' }
    );
  });
});
