import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: any) => Promise<void>>(),
  enabled: { value: true },
  flagged: { value: true },
  flagError: { value: false },
  flagChecks: [] as string[],
  consumerFindUnique: vi.fn(),
  consumerDeviceFindUnique: vi.fn(),
  syncScopeAdd: vi.fn(),
  syncEntityAdd: vi.fn(),
  agentReconcile: vi.fn(),
  instanceFindUnique: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: (event: string, handler: (event: any) => Promise<void>) =>
      mocks.listeners.set(event, handler)
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: async (hook: () => unknown) => await hook(),
  db: {
    consumer: { findUnique: mocks.consumerFindUnique },
    consumerDevice: { findUnique: mocks.consumerDeviceFindUnique },
    instance: { findUnique: mocks.instanceFindUnique }
  }
}));

vi.mock('../src/lib/client', () => ({
  isAgentTrackingEnabled: () => mocks.enabled.value
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: {
    isFlagEnabledForScope: async (d: { organization: { id: string } }) => {
      mocks.flagChecks.push(d.organization.id);
      if (mocks.flagError.value) throw new Error('flag provider unavailable');
      return mocks.flagged.value;
    }
  }
}));

vi.mock('../src/queues/syncScope', () => ({ syncScopeQueue: { add: mocks.syncScopeAdd } }));

vi.mock('../src/queues/syncEntity', () => ({ syncEntityQueue: { add: mocks.syncEntityAdd } }));

vi.mock('../src/queues/reconcile', () => ({ enqueueAgentReconcile: mocks.agentReconcile }));

await import('../src/listeners/scope');
await import('../src/listeners/entity');

let fire = async (event: string, payload: any) => {
  let handler = mocks.listeners.get(event);
  if (!handler) throw new Error(`No listener for ${event}`);

  await handler(payload);
};

describe('agent-tracking listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    mocks.flagged.value = true;
    mocks.flagError.value = false;
    mocks.flagChecks.length = 0;
    mocks.consumerFindUnique.mockResolvedValue({ organization: { id: 'org_c' } });
    mocks.consumerDeviceFindUnique.mockResolvedValue({
      instance: { organization: { id: 'org_d' } }
    });
    mocks.instanceFindUnique.mockResolvedValue({ organization: { id: 'org_i' } });
  });

  it('enqueue nothing while agent tracking is not configured', async () => {
    mocks.enabled.value = false;

    await fire('organization.updated:after', { organization: { id: 'org_1' } });
    await fire('consumer.profile.updated:after', {
      consumerProfile: { consumer: { id: 'c' } }
    });

    expect(mocks.syncScopeAdd).not.toHaveBeenCalled();
    expect(mocks.syncEntityAdd).not.toHaveBeenCalled();
    expect(mocks.flagChecks).toEqual([]);
  });

  it('enqueue nothing for an organization without the agent tracking flag', async () => {
    mocks.flagged.value = false;

    await fire('organization.updated:after', { organization: { id: 'org_1' } });
    await fire('organization.project.instance.updated:after', {
      organization: { id: 'org_1' },
      instance: { id: 'inst_1' }
    });
    await fire('consumer.profile.updated:after', {
      consumerProfile: { consumer: { id: 'con_1' } }
    });
    await fire('consumer.device.enrolled:after', { consumerDevice: { id: 'codv_1' } });

    expect(mocks.flagChecks).toEqual(['org_1', 'org_1', 'org_c', 'org_d']);
    expect(mocks.syncScopeAdd).not.toHaveBeenCalled();
    expect(mocks.syncEntityAdd).not.toHaveBeenCalled();
  });

  it('enqueue the sync when the flag cannot be read, for the processor to check again', async () => {
    mocks.flagError.value = true;

    await fire('organization.updated:after', { organization: { id: 'org_1' } });
    await fire('consumer.updated:after', { consumer: { id: 'con_1' } });

    expect(mocks.syncScopeAdd).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
    expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'consumer', id: 'con_1' });
  });

  it('enqueue the sync when the entity row cannot be read', async () => {
    mocks.consumerDeviceFindUnique.mockRejectedValue(new Error('connection reset'));

    await fire('consumer.device.updated:after', { consumerDevice: { id: 'codv_1' } });

    expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'device', id: 'codv_1' });
  });

  it('enqueue nothing for an entity whose row is gone', async () => {
    mocks.consumerFindUnique.mockResolvedValue(null);

    await fire('consumer.updated:after', { consumer: { id: 'con_1' } });

    expect(mocks.flagChecks).toEqual([]);
    expect(mocks.syncEntityAdd).not.toHaveBeenCalled();
  });

  it.each([
    ['organization.updated:after', { organization: { id: 'org_1' } }, 'organization', 'org_1'],
    ['organization.deleted:after', { organization: { id: 'org_1' } }, 'organization', 'org_1'],
    [
      'organization.project.updated:after',
      { organization: { id: 'org_1' }, project: { id: 'proj_1' } },
      'project',
      'proj_1'
    ],
    [
      'organization.project.deleted:after',
      { organization: { id: 'org_1' }, project: { id: 'proj_1' } },
      'project',
      'proj_1'
    ],
    [
      'organization.project.instance.updated:after',
      { organization: { id: 'org_1' }, instance: { id: 'inst_1' } },
      'instance',
      'inst_1'
    ],
    [
      'organization.project.instance.deleted:after',
      { organization: { id: 'org_1' }, instance: { id: 'inst_1' } },
      'instance',
      'inst_1'
    ]
  ])('%s enqueues a scope sync', async (event, payload, type, id) => {
    await fire(event, payload);

    expect(mocks.flagChecks).toEqual(['org_1']);
    expect(mocks.syncScopeAdd).toHaveBeenCalledWith({ type, id });
  });

  it.each([
    'organization.created:after',
    'organization.project.created:after',
    'organization.project.instance.created:after'
  ])('does not listen to %s: a new scope reaches the service on its first use', event => {
    expect(mocks.listeners.has(event)).toBe(false);
  });

  it.each([
    ['consumer.created:after', { consumer: { id: 'con_1' } }],
    ['consumer.updated:after', { consumer: { id: 'con_1' } }],
    ['consumer.identity.created:after', { instanceConsumer: { consumer: { id: 'con_1' } } }],
    ['consumer.identity.updated:after', { instanceConsumer: { consumer: { id: 'con_1' } } }],
    ['consumer.profile.created:after', { consumerProfile: { consumer: { id: 'con_1' } } }],
    ['consumer.profile.updated:after', { consumerProfile: { consumer: { id: 'con_1' } } }],
    ['consumer.profile.deleted:after', { consumerProfile: { consumer: { id: 'con_1' } } }]
  ])('%s enqueues a consumer sync', async (event, payload) => {
    await fire(event, payload);

    expect(mocks.consumerFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'con_1' } })
    );
    expect(mocks.flagChecks).toEqual(['org_c']);
    expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'consumer', id: 'con_1' });
  });

  it.each(['consumer.device.enrolled:after', 'consumer.device.updated:after'])(
    '%s enqueues a device sync',
    async event => {
      await fire(event, { consumerDevice: { id: 'codv_1' } });

      expect(mocks.consumerDeviceFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'codv_1' } })
      );
      expect(mocks.flagChecks).toEqual(['org_d']);
      expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'device', id: 'codv_1' });
    }
  );

  it('syncs a device when it reports a newly detected tool', async () => {
    await fire('consumer.device.detections.changed:after', {
      consumerDevice: { id: 'codv_1' },
      added: ['ollama'],
      removed: []
    });

    expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'device', id: 'codv_1' });
  });

  it('reconciles agents when a device lost tools', async () => {
    await fire('consumer.device.detections.changed:after', {
      consumerDevice: { id: 'codv_1', instanceOid: 3n },
      added: [],
      removed: ['ollama']
    });

    expect(mocks.syncEntityAdd).not.toHaveBeenCalled();
    expect(mocks.agentReconcile).toHaveBeenCalledWith('org_i');
  });

  it('reconciles agents when a device ends or detection is turned off', async () => {
    await fire('consumer.device.ended:after', { consumerDevice: { instanceOid: 3n } });
    await fire('consumer.device_settings.updated:after', {
      consumerDeviceSettings: { instanceOid: 3n, aiToolDetectionEnabled: false },
      previousConsumerDeviceSettings: { aiToolDetectionEnabled: true }
    });

    expect(mocks.agentReconcile).toHaveBeenCalledTimes(2);
  });

  it('leaves agents alone when detection is turned on', async () => {
    await fire('consumer.device_settings.updated:after', {
      consumerDeviceSettings: { instanceOid: 3n, aiToolDetectionEnabled: true },
      previousConsumerDeviceSettings: null
    });

    expect(mocks.agentReconcile).not.toHaveBeenCalled();
  });
});
