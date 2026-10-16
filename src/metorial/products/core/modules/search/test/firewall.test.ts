import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  search: vi.fn(),
  index: vi.fn(),
  remove: vi.fn(),
  enabled: true
}));

vi.mock('../src/env', () => ({
  env: {
    service: {
      get VOYAGER_URL() {
        return mocks.enabled ? 'http://voyager.local' : undefined;
      },
      VOYAGER_INDEX_PREFIX: 'test'
    }
  }
}));
vi.mock('@metorial-platform-systems/voyager-client', () => ({
  createVoyagerClient: () => ({
    source: { upsert: async () => ({ id: 'source' }) },
    index: { upsert: async () => ({ id: 'firewalls' }) },
    record: { search: mocks.search, index: mocks.index, delete: mocks.remove }
  })
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.enabled = true;
});

describe('Voyager firewall documents', () => {
  it('indexes only name and description in the searchable body under the owning instance', async () => {
    let { indexFirewallDocument } = await import('../src');
    await indexFirewallDocument({
      id: 'firewall',
      instanceId: 'instance',
      name: 'Office',
      description: 'Private traffic'
    });

    expect(mocks.index).toHaveBeenCalledWith({
      sourceId: 'source',
      indexId: 'firewalls',
      documentId: 'firewall',
      tenantIds: ['instance'],
      fields: { firewallId: 'firewall' },
      body: { name: 'Office', description: 'Private traffic' }
    });
  });

  it('scopes search to the instance and returns document IDs', async () => {
    mocks.search.mockResolvedValue([{ documentId: 'match' }, { documentId: null }]);
    let { searchFirewallIds } = await import('../src');
    expect(await searchFirewallIds({ instanceId: 'instance', query: ' Private ' })).toEqual([
      'match'
    ]);
    expect(mocks.search).toHaveBeenCalledWith({
      sourceId: 'source',
      indexId: 'firewalls',
      tenantId: 'instance',
      query: 'Private'
    });
  });

  it('returns no matches and logs Voyager failures', async () => {
    mocks.search.mockRejectedValue(new Error('offline'));
    let log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let { searchFirewallIds } = await import('../src');
      expect(await searchFirewallIds({ instanceId: 'instance', query: 'Private' })).toEqual(
        []
      );
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('returns no matches when Voyager is disabled', async () => {
    mocks.enabled = false;
    let { searchFirewallIds } = await import('../src');
    expect(await searchFirewallIds({ instanceId: 'instance', query: 'Private' })).toEqual([]);
    expect(mocks.search).not.toHaveBeenCalled();
  });
});
