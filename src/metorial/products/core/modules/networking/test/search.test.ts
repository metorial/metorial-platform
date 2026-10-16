import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirewall: vi.fn(),
  findInstance: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
  index: vi.fn(),
  remove: vi.fn(),
  enqueue: vi.fn(),
  listeners: new Map<string, (data: any) => Promise<void>>()
}));

vi.mock('@metorial/db', () => ({
  db: {
    firewall: { findUnique: mocks.findFirewall },
    instance: { findUnique: mocks.findInstance }
  },
  ID: {},
  withTransaction: vi.fn(),
  addAwaitedAfterTransactionHook: vi.fn()
}));
vi.mock('@metorial-subspace/db', () => ({ db: { firewall: { findMany: mocks.list } } }));
vi.mock('@metorial/module-search', () => ({
  searchFirewallIds: mocks.search,
  indexFirewallDocument: mocks.index,
  deleteFirewallDocument: mocks.remove
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: (name: string, handler: any) => mocks.listeners.set(name, handler) }
}));
vi.mock('@metorial/queue', () => ({
  createQueue: () => ({ add: mocks.enqueue, process: (handler: any) => handler })
}));
vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (callback: any) => callback({ prisma: (query: any) => query({ take: 25 }) })
  }
}));
vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeStatusForList: (d: any) => ({
    noParent: { status: { in: d.status ?? ['active', 'archived'] } }
  }),
  resolveEnclaves: async () => undefined,
  resolveProviders: async () => undefined,
  resolveNetworkPolicies: async (_scope: any, ids: any) => (ids ? { in: [7n] } : undefined),
  normalizeDateFilter: (value: any) => value
}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({}),
  resolveMetorialFacing: async () => ({
    tenant: { oid: 1n },
    environment: { oid: 2n, instanceOid: 3n }
  })
}));
vi.mock('../src/internal/subspaceMirror', () => ({ mirrorFirewall: vi.fn() }));

let { firewallService } = await import('../src/services/firewall');
let { indexFirewallQueueProcessor } = await import('../src/queues/search');
let processFirewall = indexFirewallQueueProcessor as unknown as (data: {
  firewallId: string;
}) => Promise<void>;
let scope = { tenant: { oid: 1n }, environment: { oid: 2n, instanceOid: 3n } } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findInstance.mockResolvedValue({ id: 'instance' });
  mocks.search.mockResolvedValue(['match']);
  mocks.list.mockResolvedValue([]);
});

describe('firewall search', () => {
  it('intersects trimmed search results with scope and existing filters', async () => {
    let createdAt = { gte: new Date('2026-01-01') };
    await firewallService.listFirewallsInternal({
      ...scope,
      search: '  private  ',
      ids: ['match', 'other'],
      status: ['active'],
      networkPolicyIds: ['policy'],
      machineIds: ['machine'],
      createdAt
    });

    expect(mocks.search).toHaveBeenCalledWith({ instanceId: 'instance', query: 'private' });
    expect(mocks.list.mock.calls[0][0]).toMatchObject({
      take: 25,
      where: {
        tenantOid: 1n,
        environmentOid: 2n,
        status: { in: ['active'] },
        AND: [
          { id: { in: ['match'] } },
          { id: { in: ['match', 'other'] } },
          { networkPolicyLinks: { some: { networkPolicyOid: [7n] } } },
          { machineLinks: { some: { machine: { id: { in: ['machine'] } } } } },
          { createdAt }
        ]
      }
    });
  });

  it('forwards search through the public list method', async () => {
    await firewallService.listFirewalls({
      instance: { id: 'instance' },
      search: 'private'
    } as any);
    expect(mocks.search).toHaveBeenCalledWith({ instanceId: 'instance', query: 'private' });
  });

  it.each([undefined, '', '   '])('keeps unfiltered listing for %s', async search => {
    await firewallService.listFirewallsInternal({ ...scope, search });
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.findInstance).not.toHaveBeenCalled();
    expect(mocks.list.mock.calls[0][0].where.AND).toEqual([]);
  });

  it('does not broaden an empty search result', async () => {
    mocks.search.mockResolvedValue([]);
    await firewallService.listFirewallsInternal({ ...scope, search: 'missing' });
    expect(mocks.list.mock.calls[0][0].where.AND).toEqual([{ id: { in: [] } }]);
  });
});

describe('firewall indexing', () => {
  it('enqueues after mirroring', async () => {
    await mocks.listeners.get('networking.firewall.mirrored:after')!({
      firewallId: 'firewall'
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({ firewallId: 'firewall' });
  });

  it.each(['active', 'archived'])(
    'indexes current %s firewall details and instance',
    async status => {
      mocks.findFirewall.mockResolvedValue({
        id: 'firewall',
        name: 'Updated name',
        description: 'Private traffic',
        status,
        instance: { id: 'instance' }
      });
      await processFirewall({ firewallId: 'firewall' });

      expect(mocks.index).toHaveBeenCalledWith({
        id: 'firewall',
        instanceId: 'instance',
        name: 'Updated name',
        description: 'Private traffic'
      });
      expect(mocks.remove).not.toHaveBeenCalled();
    }
  );

  it.each([null, { status: 'deleted' }])(
    'removes missing or deleted firewalls',
    async firewall => {
      mocks.findFirewall.mockResolvedValue(firewall);
      await processFirewall({ firewallId: 'firewall' });
      expect(mocks.remove).toHaveBeenCalledWith({ id: 'firewall' });
      expect(mocks.index).not.toHaveBeenCalled();
    }
  );
});
