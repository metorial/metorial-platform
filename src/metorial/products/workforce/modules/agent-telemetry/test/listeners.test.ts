import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: any) => Promise<void>>(),
  enabled: { value: true },
  syncScopeAdd: vi.fn(),
  syncEntityAdd: vi.fn(),
  revokeDeviceAdd: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: (event: string, handler: (event: any) => Promise<void>) =>
      mocks.listeners.set(event, handler)
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: async (hook: () => unknown) => await hook()
}));

vi.mock('../src/internal/groundstation', () => ({
  isAgentTelemetryEnabled: () => mocks.enabled.value
}));

vi.mock('../src/queues/syncScope', () => ({ syncScopeQueue: { add: mocks.syncScopeAdd } }));

vi.mock('../src/queues/syncEntity', () => ({ syncEntityQueue: { add: mocks.syncEntityAdd } }));

vi.mock('../src/queues/revokeTokens', () => ({
  revokeDeviceIngestTokensQueue: { add: mocks.revokeDeviceAdd }
}));

await import('../src/listeners/scope');
await import('../src/listeners/entity');

let fire = async (event: string, payload: any) => {
  let handler = mocks.listeners.get(event);
  if (!handler) throw new Error(`No listener for ${event}`);

  await handler(payload);
};

describe('agent-telemetry listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
  });

  it('enqueue nothing while Groundstation is not configured', async () => {
    mocks.enabled.value = false;

    await fire('organization.created:after', { organization: { id: 'org_1' } });
    await fire('consumer.profile.updated:after', {
      consumerProfile: { consumer: { id: 'c' } }
    });
    await fire('consumer.device.ended:after', { consumerDevice: { id: 'codv_1' } });

    expect(mocks.syncScopeAdd).not.toHaveBeenCalled();
    expect(mocks.syncEntityAdd).not.toHaveBeenCalled();
    expect(mocks.revokeDeviceAdd).not.toHaveBeenCalled();
  });

  it.each([
    ['organization.created:after', { organization: { id: 'org_1' } }, 'organization', 'org_1'],
    ['organization.updated:after', { organization: { id: 'org_1' } }, 'organization', 'org_1'],
    ['organization.deleted:after', { organization: { id: 'org_1' } }, 'organization', 'org_1'],
    ['organization.project.created:after', { project: { id: 'proj_1' } }, 'project', 'proj_1'],
    ['organization.project.updated:after', { project: { id: 'proj_1' } }, 'project', 'proj_1'],
    ['organization.project.deleted:after', { project: { id: 'proj_1' } }, 'project', 'proj_1'],
    [
      'organization.project.instance.created:after',
      { instance: { id: 'inst_1' } },
      'instance',
      'inst_1'
    ],
    [
      'organization.project.instance.updated:after',
      { instance: { id: 'inst_1' } },
      'instance',
      'inst_1'
    ],
    [
      'organization.project.instance.deleted:after',
      { instance: { id: 'inst_1' } },
      'instance',
      'inst_1'
    ]
  ])('%s enqueues a scope sync', async (event, payload, type, id) => {
    await fire(event, payload);

    expect(mocks.syncScopeAdd).toHaveBeenCalledWith({ type, id });
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

    expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'consumer', id: 'con_1' });
  });

  it.each(['consumer.device.enrolled:after', 'consumer.device.updated:after'])(
    '%s enqueues a device sync',
    async event => {
      await fire(event, { consumerDevice: { id: 'codv_1' } });

      expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'device', id: 'codv_1' });
      expect(mocks.revokeDeviceAdd).not.toHaveBeenCalled();
    }
  );

  it('an ended device is synced and its ingest tokens revoked', async () => {
    await fire('consumer.device.ended:after', { consumerDevice: { id: 'codv_1' } });

    expect(mocks.syncEntityAdd).toHaveBeenCalledWith({ type: 'device', id: 'codv_1' });
    expect(mocks.revokeDeviceAdd).toHaveBeenCalledWith({ consumerDeviceId: 'codv_1' });
  });
});
