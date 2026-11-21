import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: any) => Promise<void>>(),
  enabled: { value: true },
  shouldSync: { value: true },
  loadedOrganizations: [] as unknown[],
  instanceFindUnique: vi.fn(),
  syncEntities: vi.fn(),
  revokeDeviceAdd: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: (event: string, handler: (event: any) => Promise<void>) =>
      mocks.listeners.set(event, handler)
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: async (hook: () => unknown) => await hook(),
  db: { instance: { findUnique: mocks.instanceFindUnique } }
}));

vi.mock('@metorial/module-agent-tracking-sync', () => ({
  agentTrackingSyncService: { syncEntities: mocks.syncEntities },
  isAgentTrackingEnabled: () => mocks.enabled.value,
  shouldSyncOrganization: async (load: () => Promise<unknown>) => {
    mocks.loadedOrganizations.push(await load());
    return mocks.shouldSync.value;
  }
}));

vi.mock('../src/queues/revokeTokens', () => ({
  revokeDeviceIngestTokensQueue: { add: mocks.revokeDeviceAdd }
}));

await import('../src/listeners/device');

let fire = async (event: string, payload: any) => {
  let handler = mocks.listeners.get(event);
  if (!handler) throw new Error(`No listener for ${event}`);

  await handler(payload);
};

describe('agent-tracking-access listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    mocks.shouldSync.value = true;
    mocks.loadedOrganizations.length = 0;
    mocks.instanceFindUnique.mockResolvedValue({ organization: { id: 'org_1' } });
  });

  it('enqueue nothing while agent tracking is not configured', async () => {
    mocks.enabled.value = false;

    await fire('consumer.device.ended:after', {
      consumerDevice: { id: 'codv_1', instanceOid: 5n }
    });

    expect(mocks.syncEntities).not.toHaveBeenCalled();
    expect(mocks.revokeDeviceAdd).not.toHaveBeenCalled();
  });

  it.each(['consumer.device.enrolled:after', 'consumer.device.updated:after'])(
    '%s revokes no ingest token',
    async event => {
      expect(mocks.listeners.has(event)).toBe(false);
      expect(mocks.revokeDeviceAdd).not.toHaveBeenCalled();
    }
  );

  it('an ended device is synced and its ingest tokens revoked', async () => {
    await fire('consumer.device.ended:after', {
      consumerDevice: { id: 'codv_1', instanceOid: 5n }
    });

    expect(mocks.syncEntities).toHaveBeenCalledWith({
      entities: [{ type: 'device', id: 'codv_1' }]
    });
    expect(mocks.revokeDeviceAdd).toHaveBeenCalledWith({ consumerDeviceId: 'codv_1' });
    expect(mocks.instanceFindUnique).toHaveBeenCalledWith({
      where: { oid: 5n },
      include: { organization: true }
    });
    expect(mocks.loadedOrganizations).toEqual([{ id: 'org_1' }]);
  });

  it('revokes the ingest tokens of an ended device without syncing it when the flag is off', async () => {
    mocks.shouldSync.value = false;

    await fire('consumer.device.ended:after', {
      consumerDevice: { id: 'codv_1', instanceOid: 5n }
    });

    expect(mocks.syncEntities).not.toHaveBeenCalled();
    expect(mocks.revokeDeviceAdd).toHaveBeenCalledWith({ consumerDeviceId: 'codv_1' });
  });
});
