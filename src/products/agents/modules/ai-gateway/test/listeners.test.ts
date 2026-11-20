import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: any) => Promise<void>>(),
  enabled: { value: true },
  syncScopeAdd: vi.fn()
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

vi.mock('../src/lib/client', () => ({
  isAiGatewayEnabled: () => mocks.enabled.value
}));

vi.mock('../src/queues/syncScope', () => ({ syncScopeQueue: { add: mocks.syncScopeAdd } }));

await import('../src/listeners/scope');

let fire = async (event: string, payload: any) => {
  let handler = mocks.listeners.get(event);
  if (!handler) throw new Error(`No listener for ${event}`);

  await handler(payload);
};

describe('ai-gateway listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
  });

  it('enqueue nothing while the gateway is not configured', async () => {
    mocks.enabled.value = false;

    await fire('organization.created:after', { organization: { id: 'org_1' } });

    expect(mocks.syncScopeAdd).not.toHaveBeenCalled();
  });

  it.each(['created', 'updated', 'deleted'])('syncs an organization when %s', async action => {
    await fire(`organization.${action}:after`, { organization: { id: 'org_1' } });

    expect(mocks.syncScopeAdd).toHaveBeenCalledWith({ type: 'organization', id: 'org_1' });
  });

  it.each(['created', 'updated', 'deleted'])('syncs a project when %s', async action => {
    await fire(`organization.project.${action}:after`, { project: { id: 'proj_1' } });

    expect(mocks.syncScopeAdd).toHaveBeenCalledWith({ type: 'project', id: 'proj_1' });
  });

  it.each(['created', 'updated', 'deleted'])('syncs an instance when %s', async action => {
    await fire(`organization.project.instance.${action}:after`, {
      instance: { id: 'inst_1' }
    });

    expect(mocks.syncScopeAdd).toHaveBeenCalledWith({ type: 'instance', id: 'inst_1' });
  });
});
