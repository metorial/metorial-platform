import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  fire: vi.fn(),
  findSuppressions: vi.fn(),
  findSuppression: vi.fn(),
  createSuppression: vi.fn(),
  updateSuppression: vi.fn(),
  findFilter: vi.fn(),
  findProvider: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` }),
  db: {
    protoGuardSuppression: {
      findMany: mocks.findSuppressions,
      findFirst: mocks.findSuppression,
      create: mocks.createSuppression,
      update: mocks.updateSuppression
    },
    protoGuardFilter: { findFirst: mocks.findFilter },
    provider: { findFirst: mocks.findProvider }
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => ({
      run: async () => await factory({ prisma: async (fn: any) => await fn({ take: 10 }) })
    })
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  resolveMetorialFacing: async () => ({
    tenant: { oid: BigInt(11), projectOid: BigInt(12) },
    environment: { oid: BigInt(13) }
  }),
  toProviderEventBase: () => ({ tenantId: 'tenant_11', auditScope: { kind: 'test' } })
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

import { protoGuardSuppressionService } from './protoGuardSuppression';

let HMAC = 'a'.repeat(64);

let FILTER = {
  oid: BigInt(21),
  id: 'pgflt_1',
  key: 'instruction_override',
  name: 'Instruction override'
};
let PROVIDER = { oid: BigInt(31), id: 'prov_1' };

let facing = <T>(d: T) => ({ ...d }) as any;

let create = (input: Record<string, unknown> = {}) =>
  protoGuardSuppressionService.createSuppression(
    facing({ input: { filterId: 'pgflt_1', ...input } })
  );

let stored = (overrides: Record<string, unknown> = {}) => ({
  oid: BigInt(41),
  id: 'pgsup_1',
  status: 'active',
  reason: 'false positive',
  toolKey: 'search',
  contentHmac: HMAC,
  expiresAt: null,
  archivedAt: null,
  createdAt: new Date('2026-01-01'),
  tenantOid: BigInt(11),
  filter: FILTER,
  provider: PROVIDER,
  ...overrides
});

describe('protoGuardSuppressionService', () => {
  beforeEach(() => {
    for (let mock of Object.values(mocks)) mock.mockReset();

    mocks.findFilter.mockResolvedValue(FILTER);
    mocks.findProvider.mockResolvedValue(PROVIDER);
    mocks.createSuppression.mockImplementation(async (args: any) =>
      stored({
        ...args.data,
        filter: FILTER,
        provider: args.data.providerOid ? PROVIDER : null
      })
    );
    mocks.updateSuppression.mockImplementation(async (args: any) => stored({ ...args.data }));
  });

  describe('createSuppression', () => {
    it('creates a suppression scoped to the tenant', async () => {
      await create({
        providerId: 'prov_1',
        toolKey: 'search',
        contentHmac: HMAC,
        reason: 'false positive'
      });

      expect(mocks.createSuppression.mock.calls[0]![0].data).toMatchObject({
        tenantOid: BigInt(11),
        projectOid: BigInt(12),
        filterOid: BigInt(21),
        providerOid: BigInt(31),
        toolKey: 'search',
        contentHmac: HMAC,
        reason: 'false positive',
        expiresAt: null
      });
    });

    it('stores empty optional strings as null wildcards', async () => {
      await create({ toolKey: '', contentHmac: '', reason: '' });

      expect(mocks.findProvider).not.toHaveBeenCalled();
      expect(mocks.createSuppression.mock.calls[0]![0].data).toMatchObject({
        providerOid: null,
        toolKey: null,
        contentHmac: null,
        reason: null
      });
    });

    it.each([
      ['reason', { reason: 'x'.repeat(1001) }, /invalid_reason/],
      ['tool key', { toolKey: 'x'.repeat(513) }, /invalid_tool_key/],
      ['content hmac', { contentHmac: 'x'.repeat(129) }, /invalid_content_hmac/],
      ['past expiry', { expiresAt: new Date(Date.now() - 1000) }, /invalid_expires_at/]
    ])('rejects an invalid %s', async (_name, input, code) => {
      await expect(create(input)).rejects.toThrow(code);
      expect(mocks.createSuppression).not.toHaveBeenCalled();
      expect(mocks.fire).not.toHaveBeenCalled();
    });

    it('accepts values at the length limits and a future expiry', async () => {
      await expect(
        create({
          reason: 'x'.repeat(1000),
          toolKey: 'x'.repeat(512),
          contentHmac: 'x'.repeat(128),
          expiresAt: new Date(Date.now() + 60_000)
        })
      ).resolves.toBeDefined();
    });

    it('looks the filter up by id or key', async () => {
      await create({ filterId: 'instruction_override' });

      expect(mocks.findFilter).toHaveBeenCalledWith({
        where: { OR: [{ id: 'instruction_override' }, { key: 'instruction_override' }] }
      });
    });

    it('rejects an unknown filter', async () => {
      mocks.findFilter.mockResolvedValue(null);

      await expect(create({ filterId: 'nope' })).rejects.toThrow(/not_found/);
      expect(mocks.createSuppression).not.toHaveBeenCalled();
    });

    it('rejects an unknown provider', async () => {
      mocks.findProvider.mockResolvedValue(null);

      await expect(create({ providerId: 'prov_missing' })).rejects.toThrow(/not_found/);
      expect(mocks.createSuppression).not.toHaveBeenCalled();
    });

    it('only resolves public providers or providers owned by the tenant', async () => {
      await create({ providerId: 'prov_1' });

      expect(mocks.findProvider).toHaveBeenCalledWith({
        where: {
          id: 'prov_1',
          OR: [{ access: 'public' }, { ownerTenantOid: BigInt(11) }]
        }
      });
    });

    it('fires before/after events whose audit payload never contains the hmac', async () => {
      await create({ providerId: 'prov_1', toolKey: 'search', contentHmac: HMAC });

      expect(mocks.fire).toHaveBeenNthCalledWith(1, 'protoguard.suppression.created:before', {
        tenantId: 'tenant_11',
        auditScope: { kind: 'test' },
        filterId: 'pgflt_1'
      });

      let [event, payload] = mocks.fire.mock.calls[1]!;
      expect(event).toBe('protoguard.suppression.created:after');
      expect(payload.suppression).toEqual({
        id: 'protoGuardSuppression_1',
        status: 'active',
        reason: null,
        filter: { id: 'pgflt_1', key: 'instruction_override', name: 'Instruction override' },
        providerId: 'prov_1',
        toolKey: 'search',
        hasContentHmac: true,
        expiresAt: null,
        archivedAt: null,
        createdAt: expect.any(Date)
      });
      expect(JSON.stringify(mocks.fire.mock.calls)).not.toContain(HMAC);
    });

    it('reports hasContentHmac false without an hmac', async () => {
      await create();

      expect(mocks.fire.mock.calls[1]![1].suppression.hasContentHmac).toBe(false);
    });
  });

  describe('listSuppressions', () => {
    let list = async (d: Record<string, unknown> = {}) => {
      mocks.findSuppressions.mockResolvedValue([]);
      let paginator: any = await protoGuardSuppressionService.listSuppressions(facing(d));
      await paginator.run();
      return mocks.findSuppressions.mock.calls[0]![0];
    };

    it('defaults to active suppressions of the tenant', async () => {
      let args = await list();

      expect(args.take).toBe(10);
      expect(args.where).toEqual({ tenantOid: BigInt(11), status: 'active' });
      expect(args.include).toEqual({ filter: true, provider: true });
    });

    it('filters by status, filter id or key, and provider', async () => {
      let args = await list({
        statuses: ['archived'],
        filterIds: ['pgflt_1', 'role_hijack'],
        providerIds: ['prov_1']
      });

      expect(args.where).toEqual({
        tenantOid: BigInt(11),
        status: { in: ['archived'] },
        filter: {
          OR: [
            { id: { in: ['pgflt_1', 'role_hijack'] } },
            { key: { in: ['pgflt_1', 'role_hijack'] } }
          ]
        },
        provider: { id: { in: ['prov_1'] } }
      });
    });
  });

  describe('getSuppressionById', () => {
    it('scopes the lookup to the tenant', async () => {
      mocks.findSuppression.mockResolvedValue(stored());
      await protoGuardSuppressionService.getSuppressionById(
        facing({ suppressionId: 'pgsup_1' })
      );

      expect(mocks.findSuppression).toHaveBeenCalledWith({
        where: { id: 'pgsup_1', tenantOid: BigInt(11) },
        include: { filter: true, provider: true }
      });
    });

    it('throws not found for another tenant or a missing id', async () => {
      mocks.findSuppression.mockResolvedValue(null);

      await expect(
        protoGuardSuppressionService.getSuppressionById(facing({ suppressionId: 'pgsup_x' }))
      ).rejects.toThrow(/not_found/);
    });
  });

  describe('archiveSuppression', () => {
    it('archives and fires events without the hmac', async () => {
      let result = await protoGuardSuppressionService.archiveSuppression(
        facing({ suppression: stored() })
      );

      expect(mocks.updateSuppression).toHaveBeenCalledWith({
        where: { oid: BigInt(41) },
        data: { status: 'archived', archivedAt: expect.any(Date) },
        include: { filter: true, provider: true }
      });
      expect(result.status).toBe('archived');

      expect(mocks.fire).toHaveBeenNthCalledWith(1, 'protoguard.suppression.archived:before', {
        tenantId: 'tenant_11',
        auditScope: { kind: 'test' },
        suppressionId: 'pgsup_1'
      });
      let [event, payload] = mocks.fire.mock.calls[1]!;
      expect(event).toBe('protoguard.suppression.archived:after');
      expect(payload.suppression).toMatchObject({ status: 'archived', hasContentHmac: true });
      expect(JSON.stringify(mocks.fire.mock.calls)).not.toContain(HMAC);
    });

    it('rejects archiving twice', async () => {
      await expect(
        protoGuardSuppressionService.archiveSuppression(
          facing({ suppression: stored({ status: 'archived' }) })
        )
      ).rejects.toThrow(/suppression_archived/);
      expect(mocks.updateSuppression).not.toHaveBeenCalled();
      expect(mocks.fire).not.toHaveBeenCalled();
    });
  });
});
