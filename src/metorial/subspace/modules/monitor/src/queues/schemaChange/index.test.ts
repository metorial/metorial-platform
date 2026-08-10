import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues: Record<string, any> = {};

let monitorFindUnique = vi.fn();
let monitorFindMany = vi.fn();
let monitorUpdate = vi.fn();
let notificationFindUnique = vi.fn();
let notificationFindMany = vi.fn();
let monitorAlertCreateMany = vi.fn();
let monitorAlertUpdateMany = vi.fn();
let monitorAlertEventCreate = vi.fn();

let db = {
  monitor: {
    findUnique: monitorFindUnique,
    findMany: monitorFindMany,
    update: monitorUpdate
  },
  providerSpecificationChangeNotification: {
    findUnique: notificationFindUnique,
    findMany: notificationFindMany
  },
  monitorAlert: {
    createMany: monitorAlertCreateMany,
    updateMany: monitorAlertUpdateMany
  },
  monitorAlertEvent: {
    create: monitorAlertEventCreate
  }
};

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  combineQueueProcessors: (processors: unknown[]) => processors,
  createQueue: (opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addMany: vi.fn(),
      process: vi.fn((processor: unknown) => {
        queue.processor = processor;
        return { name: opts.name };
      }),
      processor: undefined as unknown
    };

    queues[opts.name] = queue;
    return queue;
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: (model: string) => ({ oid: BigInt(100), id: `${model}_id` }),
  withTransaction: async (fn: (tx: typeof db) => Promise<unknown>) => await fn(db)
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../../services/monitorInternal', () => ({
  monitorInternalService: {
    upsertProviderSpecChangeMonitor: vi.fn()
  }
}));

let baseMonitor = {
  id: 'monitor_1',
  oid: BigInt(1),
  target: 'schema_change',
  providerOid: BigInt(2),
  tenantOid: BigInt(3),
  environmentOid: BigInt(4),
  solutionOid: 5,
  firstAlertAt: null,
  lastAlertAt: null
};

let baseNotification = {
  id: 'notification_1',
  oid: BigInt(10),
  target: 'version',
  version: { providerOid: BigInt(2) },
  tenantOid: null,
  environmentOid: null,
  solutionOid: null,
  deploymentConfigPair: null,
  createdAt: new Date('2026-01-02T03:04:05.000Z')
};

describe('schema change alert queues', () => {
  beforeEach(() => {
    vi.resetModules();
    queues = {};

    monitorFindUnique.mockReset();
    monitorFindMany.mockReset();
    monitorUpdate.mockReset();
    notificationFindUnique.mockReset();
    notificationFindMany.mockReset();
    monitorAlertCreateMany.mockReset();
    monitorAlertUpdateMany.mockReset();
    monitorAlertEventCreate.mockReset();
  });

  it('dispatches deployment config pair notifications to the pair many queue', async () => {
    await import('./index');

    notificationFindUnique.mockResolvedValue({
      id: 'notification_1',
      target: 'deployment_config_pair'
    });

    await queues['sub/mon/schema/notif/ingest'].processor({
      notificationId: 'notification_1'
    });

    expect(queues['sub/mon/schema/notif/pair/many'].add).toHaveBeenCalledWith({
      notificationId: 'notification_1'
    });
    expect(queues['sub/mon/schema/notif/version/many'].add).not.toHaveBeenCalled();
  });

  it('dispatches version notifications to the version many queue', async () => {
    await import('./index');

    notificationFindUnique.mockResolvedValue({
      id: 'notification_1',
      target: 'version'
    });

    await queues['sub/mon/schema/notif/ingest'].processor({
      notificationId: 'notification_1'
    });

    expect(queues['sub/mon/schema/notif/version/many'].add).toHaveBeenCalledWith({
      notificationId: 'notification_1'
    });
    expect(queues['sub/mon/schema/notif/pair/many'].add).not.toHaveBeenCalled();
  });

  it('creates alerts and events with the notification timestamp', async () => {
    await import('./index');

    monitorFindUnique.mockResolvedValue(baseMonitor);
    notificationFindUnique.mockResolvedValue(baseNotification);
    monitorAlertCreateMany.mockResolvedValue({ count: 1 });

    await queues['sub/mon/schema/alert/single'].processor({
      monitorId: 'monitor_1',
      notificationId: 'notification_1',
      status: 'ignored'
    });

    expect(monitorAlertCreateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'ignored',
        monitorOid: baseMonitor.oid,
        specificationChangeNotificationOid: baseNotification.oid,
        createdAt: baseNotification.createdAt
      }),
      skipDuplicates: true
    });
    expect(monitorAlertEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'created',
        monitorAlertOid: BigInt(100),
        createdAt: baseNotification.createdAt
      })
    });
    expect(monitorUpdate).toHaveBeenCalledWith({
      where: { oid: baseMonitor.oid },
      data: {
        firstAlertAt: baseNotification.createdAt,
        lastAlertAt: baseNotification.createdAt
      }
    });
  });

  it('does not downgrade an existing pending alert during ignored backfill', async () => {
    await import('./index');

    let monitor = {
      ...baseMonitor,
      firstAlertAt: new Date('2026-01-01T00:00:00.000Z'),
      lastAlertAt: new Date('2026-01-03T00:00:00.000Z')
    };

    monitorFindUnique.mockResolvedValue(monitor);
    notificationFindUnique.mockResolvedValue(baseNotification);
    monitorAlertCreateMany.mockResolvedValue({ count: 0 });

    await queues['sub/mon/schema/alert/single'].processor({
      monitorId: 'monitor_1',
      notificationId: 'notification_1',
      status: 'ignored'
    });

    expect(monitorAlertUpdateMany).not.toHaveBeenCalled();
    expect(monitorAlertEventCreate).not.toHaveBeenCalled();
    expect(monitorUpdate).toHaveBeenCalledWith({
      where: { oid: baseMonitor.oid },
      data: {
        firstAlertAt: monitor.firstAlertAt,
        lastAlertAt: monitor.lastAlertAt
      }
    });
  });

  it('upgrades an existing ignored alert without creating another event', async () => {
    await import('./index');

    monitorFindUnique.mockResolvedValue(baseMonitor);
    notificationFindUnique.mockResolvedValue(baseNotification);
    monitorAlertCreateMany.mockResolvedValue({ count: 0 });
    monitorAlertUpdateMany.mockResolvedValue({ count: 1 });

    await queues['sub/mon/schema/alert/single'].processor({
      monitorId: 'monitor_1',
      notificationId: 'notification_1',
      status: 'pending'
    });

    expect(monitorAlertUpdateMany).toHaveBeenCalledWith({
      where: {
        monitorOid: baseMonitor.oid,
        specificationChangeNotificationOid: baseNotification.oid,
        status: 'ignored'
      },
      data: {
        status: 'pending',
        resolvedAt: null
      }
    });
    expect(monitorAlertEventCreate).not.toHaveBeenCalled();
  });
});
