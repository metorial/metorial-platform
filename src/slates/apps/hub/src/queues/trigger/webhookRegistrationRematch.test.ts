import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findRegistration: vi.fn(),
  findTargets: vi.fn(),
  updateTargets: vi.fn(),
  findLinks: vi.fn(),
  findInstances: vi.fn(),
  deleteErrors: vi.fn(),
  rematch: vi.fn(),
  setup: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  handler: null as any
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({
    add: mocks.rematch,
    process: (handler: any) => {
      mocks.handler = handler;
      return {};
    }
  })
}));

vi.mock('../../db', () => ({
  db: {
    slateWebhookRegistration: { findUnique: mocks.findRegistration },
    triggerWebhookTarget: { findMany: mocks.findTargets, updateMany: mocks.updateTargets },
    triggerRegistrationWebhook: { findMany: mocks.findLinks },
    triggerRegistrationInstance: { findMany: mocks.findInstances },
    triggerRegistrationInstanceError: { deleteMany: mocks.deleteErrors }
  }
}));

vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));

vi.mock('../../internal/triggerDeliveryConfigServiceInternal', () => ({
  TRIGGER_DELIVERY_CONFIG_MISSING: 'trigger_delivery_config_missing'
}));

vi.mock('./setup', () => ({
  triggerRegistrationInstanceSetupQueue: { addManyWithOps: mocks.setup }
}));

vi.mock('./webhookRegister', () => ({
  triggerWebhookRegisterQueue: { addManyWithOps: mocks.register }
}));

vi.mock('./webhookUnregister', () => ({
  triggerWebhookUnregisterQueue: { addManyWithOps: mocks.unregister }
}));

await import('./webhookRegistrationRematch');

let config = (change: Record<string, unknown> = {}) => ({
  id: 'whr_config',
  type: 'delivery_config',
  status: 'active',
  owner: 'tenant',
  tenantOid: 1n,
  slateOid: 7n,
  triggerGroupOid: 5n,
  triggerGroup: { key: 'mail' },
  ...change
});

let run = (cursor?: string) => mocks.handler({ webhookRegistrationId: 'whr_config', cursor });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findTargets.mockResolvedValue([]);
  mocks.findLinks.mockResolvedValue([]);
  mocks.findInstances.mockResolvedValue([]);
});

describe('retry after a delivery config is set up', () => {
  let failed = [
    { id: 'target-a', oid: 11n },
    { id: 'target-b', oid: 12n }
  ];

  beforeEach(() => {
    mocks.findTargets.mockResolvedValue(failed);
    mocks.findLinks.mockResolvedValue([
      { triggerWebhookTargetOid: 11n, triggerRegistrationInstance: { id: 'instance-1' } },
      { triggerWebhookTargetOid: 11n, triggerRegistrationInstance: { id: 'instance-2' } },
      { triggerWebhookTargetOid: 12n, triggerRegistrationInstance: { id: 'instance-1' } }
    ]);
  });

  it('registers the failed targets of the tenant again without waiting for the cooldown', async () => {
    mocks.findRegistration.mockResolvedValue(config());

    await run();

    expect(mocks.findTargets).toHaveBeenCalledWith({
      where: {
        id: undefined,
        status: 'failed',
        tenantOid: 1n,
        tenant: { disableCallbacks: false },
        triggerGroup: { slateOid: 7n, key: 'mail' }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    expect(mocks.updateTargets).toHaveBeenCalledWith({
      where: { oid: { in: [11n, 12n] }, status: 'failed' },
      data: {
        status: 'creating',
        webhookRegistrationOid: null,
        registeredByTriggerRegistrationOid: null,
        unregistrationStarted: false
      }
    });
    expect(mocks.deleteErrors).toHaveBeenCalledWith({
      where: {
        triggerWebhookTargetOid: { in: [11n, 12n] },
        code: 'trigger_delivery_config_missing'
      }
    });
    expect(mocks.findLinks.mock.calls[0]![0].where).toEqual({
      triggerWebhookTargetOid: { in: [11n, 12n] },
      triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
    });
    expect(mocks.register).toHaveBeenCalledWith([
      {
        data: {
          triggerWebhookTargetId: 'target-a',
          triggerRegistrationInstanceId: 'instance-1'
        },
        opts: { id: 'target-a:instance-1' }
      },
      {
        data: {
          triggerWebhookTargetId: 'target-a',
          triggerRegistrationInstanceId: 'instance-2'
        },
        opts: { id: 'target-a:instance-2' }
      },
      {
        data: {
          triggerWebhookTargetId: 'target-b',
          triggerRegistrationInstanceId: 'instance-1'
        },
        opts: { id: 'target-b:instance-1' }
      }
    ]);
    expect(mocks.rematch).not.toHaveBeenCalled();
    expect(mocks.setup).not.toHaveBeenCalled();
    expect(mocks.unregister).not.toHaveBeenCalled();
  });

  it('covers every tenant for a global config', async () => {
    mocks.findRegistration.mockResolvedValue(config({ owner: 'global', tenantOid: null }));

    await run();

    expect(mocks.findTargets.mock.calls[0]![0].where).toMatchObject({
      status: 'failed',
      tenantOid: undefined,
      triggerGroup: { slateOid: 7n, key: 'mail' }
    });
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });

  it('continues after a full batch from where it stopped', async () => {
    mocks.findRegistration.mockResolvedValue(config());
    mocks.findTargets.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ id: `target-${i}`, oid: BigInt(i) }))
    );

    await run('target-');

    expect(mocks.findTargets.mock.calls[0]![0].where.id).toEqual({ gt: 'target-' });
    expect(mocks.rematch).toHaveBeenCalledWith({
      webhookRegistrationId: 'whr_config',
      cursor: 'target-99'
    });
  });

  it('reads only what it needs to tell a delivery config apart', async () => {
    mocks.findRegistration.mockResolvedValue(config());

    await run();

    expect(mocks.findRegistration).toHaveBeenCalledWith({
      where: { id: 'whr_config' },
      select: {
        id: true,
        type: true,
        status: true,
        owner: true,
        tenantOid: true,
        slateOid: true,
        triggerGroupOid: true,
        triggerGroup: { select: { key: true } }
      }
    });
  });

  it('does nothing for a config that is not finished', async () => {
    mocks.findRegistration.mockResolvedValue(config({ status: 'awaiting_setup' }));

    await run();

    expect(mocks.findTargets).not.toHaveBeenCalled();
    expect(mocks.findInstances).not.toHaveBeenCalled();
  });
});

describe('removing a delivery config', () => {
  it('unregisters the targets that deliver through it so they register again without it', async () => {
    mocks.findRegistration.mockResolvedValue(config({ status: 'deleted' }));
    mocks.findTargets.mockResolvedValue([
      { id: 'target-a', oid: 11n },
      { id: 'target-b', oid: 12n }
    ]);

    await run();

    expect(mocks.findTargets).toHaveBeenCalledWith({
      where: {
        id: undefined,
        status: 'active',
        unregistrationStarted: false,
        webhookRegistration: { deliveryRoutes: { some: { bindingId: 'whr_config' } } }
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    expect(mocks.updateTargets).toHaveBeenCalledWith({
      where: { oid: { in: [11n, 12n] }, status: 'active', unregistrationStarted: false },
      data: { status: 'deleting', unregistrationStarted: true }
    });
    expect(mocks.unregister).toHaveBeenCalledWith([
      { data: { triggerWebhookTargetId: 'target-a' }, opts: { id: 'target-a' } },
      { data: { triggerWebhookTargetId: 'target-b' }, opts: { id: 'target-b' } }
    ]);
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.rematch).not.toHaveBeenCalled();
  });

  it('leaves everything alone when nothing delivers through it', async () => {
    mocks.findRegistration.mockResolvedValue(config({ status: 'deleted' }));

    await run();

    expect(mocks.updateTargets).not.toHaveBeenCalled();
    expect(mocks.unregister).not.toHaveBeenCalled();
  });
});

describe('manual webhook registrations', () => {
  let manual = (change: Record<string, unknown> = {}) =>
    config({ type: 'manual', triggerGroup: { key: 'events' }, ...change });

  it('still rematches the instances that had no webhook', async () => {
    mocks.findRegistration.mockResolvedValue(manual());
    mocks.findInstances.mockResolvedValue([{ id: 'instance-1' }]);

    await run();

    expect(mocks.findInstances.mock.calls[0]![0].where).toEqual({
      triggerRegistration: { tenantOid: 1n },
      triggerGroupOid: 5n,
      webhooks: { none: {} },
      id: undefined
    });
    expect(mocks.setup).toHaveBeenCalledWith([
      { data: { triggerRegistrationInstanceId: 'instance-1' }, opts: { id: 'instance-1' } }
    ]);
    expect(mocks.findTargets).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.unregister).not.toHaveBeenCalled();
  });

  it('rematches every tenant for a global registration', async () => {
    mocks.findRegistration.mockResolvedValue(manual({ owner: 'global', tenantOid: null }));

    await run();

    expect(mocks.findInstances.mock.calls[0]![0].where.triggerRegistration).toBeUndefined();
  });

  it('never releases delivery routes for a removed manual registration', async () => {
    mocks.findRegistration.mockResolvedValue(manual({ status: 'deleted' }));

    await run();

    expect(mocks.updateTargets).not.toHaveBeenCalled();
    expect(mocks.unregister).not.toHaveBeenCalled();
    expect(mocks.findInstances).toHaveBeenCalled();
  });
});
