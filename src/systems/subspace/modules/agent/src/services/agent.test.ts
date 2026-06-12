import { beforeEach, describe, expect, it, vi } from 'vitest';

let agentFindFirst = vi.fn();
let agentFindMany = vi.fn();
let agentFindUnique = vi.fn();
let agentFindFirstOrThrow = vi.fn();
let identityActorFindFirstOrThrow = vi.fn();

let createIdentityActor = vi.fn();
let getIdentityActorById = vi.fn();
let updateIdentityActor = vi.fn();
let archiveIdentityActor = vi.fn();

let voyagerSearch = vi.fn();
let resolveIdentityActors = vi.fn();
let checkTenantFn = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    agent: {
      findFirst: agentFindFirst,
      findMany: agentFindMany,
      findUnique: agentFindUnique,
      findFirstOrThrow: agentFindFirstOrThrow
    },
    identityActor: {
      findFirstOrThrow: identityActorFindFirstOrThrow
    }
  },
  withTransaction: async (fn: (db: any) => Promise<unknown>) =>
    await fn({
      agent: {
        findFirstOrThrow: agentFindFirstOrThrow
      }
    })
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: (factory: any) => ({
      run: async () => await factory({ prisma: async (fn: any) => await fn({}) })
    })
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: factory
    })
  }
}));

vi.mock('@lowerdeck/error', () => ({
  notFoundError: (resource: string, id: string) => ({ resource, id, kind: 'not_found' }),
  badRequestError: (info: any) => ({ ...info, kind: 'bad_request' }),
  ServiceError: class ServiceError extends Error {
    payload: any;
    constructor(payload: any) {
      super(typeof payload === 'object' ? JSON.stringify(payload) : String(payload));
      this.payload = payload;
    }
  }
}));

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async (input: string) => `hash_${input.length}`)
  }
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: () => 'plainid7'
}));

vi.mock('@lowerdeck/slugify', () => ({
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, '-')
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: (filter: unknown) => filter,
  normalizeStatusForGet: () => ({ hasParent: {} }),
  normalizeStatusForList: () => ({ noParent: {} }),
  resolveIdentityActors
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityActorService: {
    createIdentityActor,
    getIdentityActorById,
    updateIdentityActor,
    archiveIdentityActor
  }
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: {
    record: {
      search: voyagerSearch
    }
  },
  voyagerIndex: {
    agent: { id: 'idx_agent' }
  },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: checkTenantFn
}));

let tenant = { oid: BigInt(1), id: 'tenant_1' } as any;
let solution = { oid: 2 } as any;
let environment = { oid: BigInt(3) } as any;

describe('agentService', () => {
  beforeEach(() => {
    vi.resetModules();
    agentFindFirst.mockReset();
    agentFindMany.mockReset();
    agentFindUnique.mockReset();
    agentFindFirstOrThrow.mockReset();
    identityActorFindFirstOrThrow.mockReset();
    createIdentityActor.mockReset();
    getIdentityActorById.mockReset();
    updateIdentityActor.mockReset();
    archiveIdentityActor.mockReset();
    voyagerSearch.mockReset();
    resolveIdentityActors.mockReset();
    resolveIdentityActors.mockResolvedValue(undefined);
    checkTenantFn.mockReset();
    agentFindMany.mockResolvedValue([]);
  });

  describe('listAgents', () => {
    it('scopes list queries by tenant, environment, and solution', async () => {
      let { agentService } = await import('./agent');

      let paginator = await agentService.listAgents({ tenant, solution, environment });
      await paginator.run({});

      expect(agentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantOid: tenant.oid,
            solutionOid: solution.oid,
            environmentOid: environment.oid
          }),
          include: { actor: true }
        })
      );
    });

    it('runs voyager search when a search string is provided', async () => {
      voyagerSearch.mockResolvedValue([{ documentId: 'agent_a' }, { documentId: 'agent_b' }]);

      let { agentService } = await import('./agent');

      let paginator = await agentService.listAgents({
        tenant,
        solution,
        environment,
        search: 'support bot'
      });
      await paginator.run({});

      expect(voyagerSearch).toHaveBeenCalledWith({
        tenantId: tenant.id,
        sourceId: 'src_1',
        indexId: 'idx_agent',
        query: 'support bot'
      });
      let call = agentFindMany.mock.calls[0]![0];
      expect(call.where.AND).toEqual(
        expect.arrayContaining([{ id: { in: ['agent_a', 'agent_b'] } }])
      );
    });

    it('does not call voyager when no search string is provided', async () => {
      let { agentService } = await import('./agent');

      let paginator = await agentService.listAgents({ tenant, solution, environment });
      await paginator.run({});

      expect(voyagerSearch).not.toHaveBeenCalled();
    });

    it('forwards id, type, and date filters into the prisma query', async () => {
      let { agentService } = await import('./agent');

      let paginator = await agentService.listAgents({
        tenant,
        solution,
        environment,
        ids: ['agent_1'],
        types: ['custom'] as any,
        createdAt: { after: new Date('2026-01-01') } as any
      });
      await paginator.run({});

      let call = agentFindMany.mock.calls[0]![0];
      expect(call.where.AND).toEqual(
        expect.arrayContaining([
          { id: { in: ['agent_1'] } },
          { type: { in: ['custom'] } },
          { createdAt: { after: new Date('2026-01-01') } }
        ])
      );
    });
  });

  describe('getAgentById', () => {
    it('returns the agent when found', async () => {
      let stored = { id: 'agent_1', actor: { id: 'actor_1' } };
      agentFindFirst.mockResolvedValue(stored);

      let { agentService } = await import('./agent');

      let result = await agentService.getAgentById({
        tenant,
        solution,
        environment,
        agentId: 'agent_1'
      });

      expect(result).toBe(stored);
      expect(agentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'agent_1',
            tenantOid: tenant.oid,
            environmentOid: environment.oid
          }),
          include: { actor: true }
        })
      );
    });

    it('throws a ServiceError when the agent is missing', async () => {
      agentFindFirst.mockResolvedValue(null);

      let { agentService } = await import('./agent');

      await expect(
        agentService.getAgentById({
          tenant,
          solution,
          environment,
          agentId: 'agent_missing'
        })
      ).rejects.toMatchObject({
        payload: { resource: 'agent', id: 'agent_missing', kind: 'not_found' }
      });
    });
  });

  describe('createAgent', () => {
    it('creates an identity actor tagged as a custom agent', async () => {
      createIdentityActor.mockResolvedValue({ oid: BigInt(42) });
      agentFindFirstOrThrow.mockResolvedValue({ id: 'agent_new' });

      let { agentService } = await import('./agent');

      let result = await agentService.createAgent({
        tenant,
        solution,
        environment,
        input: { name: 'Support Bot', slug: 'support', description: 'Support bot' }
      });

      expect(createIdentityActor).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            name: 'Support Bot',
            type: 'agent',
            _agentSlug: 'support',
            _agentType: 'custom'
          })
        })
      );
      expect(agentFindFirstOrThrow).toHaveBeenCalledWith({
        where: { actorOid: BigInt(42) },
        include: { actor: true }
      });
      expect(result).toEqual({ id: 'agent_new' });
    });
  });

  describe('updateAgent', () => {
    it('rejects when the agent belongs to a different tenant', async () => {
      checkTenantFn.mockImplementation(() => {
        throw new Error('tenant mismatch');
      });

      let { agentService } = await import('./agent');

      await expect(
        agentService.updateAgent({
          tenant,
          solution,
          environment,
          agent: { actorOid: BigInt(7) } as any,
          input: { name: 'Renamed' }
        })
      ).rejects.toThrow('tenant mismatch');
    });

    it('updates the underlying identity actor and returns the refreshed agent', async () => {
      identityActorFindFirstOrThrow.mockResolvedValue({ id: 'actor_99' });
      getIdentityActorById.mockResolvedValue({ id: 'actor_99' });
      updateIdentityActor.mockResolvedValue({ oid: BigInt(99) });
      agentFindFirstOrThrow.mockResolvedValue({ id: 'agent_99' });

      let { agentService } = await import('./agent');

      let result = await agentService.updateAgent({
        tenant,
        solution,
        environment,
        agent: { actorOid: BigInt(99) } as any,
        input: { name: 'Renamed', description: 'New description' }
      });

      expect(updateIdentityActor).toHaveBeenCalledWith(
        expect.objectContaining({
          identityActor: { id: 'actor_99' },
          input: { name: 'Renamed', description: 'New description', metadata: undefined }
        })
      );
      expect(result).toEqual({ id: 'agent_99' });
    });
  });

  describe('upsertAgent', () => {
    it('returns the existing agent when the hash already matches', async () => {
      let existing = { id: 'agent_existing' };
      agentFindUnique.mockResolvedValue(existing);

      let { agentService } = await import('./agent');

      let result = await agentService.upsertAgent({
        tenant,
        solution,
        environment,
        input: { name: 'Support', type: 'custom' as any }
      });

      expect(result).toBe(existing);
      expect(createIdentityActor).not.toHaveBeenCalled();
    });

    it('creates a new agent with a generated slug when none is provided', async () => {
      agentFindUnique.mockResolvedValueOnce(null);
      createIdentityActor.mockResolvedValue({ oid: BigInt(11) });
      agentFindFirstOrThrow.mockResolvedValue({ id: 'agent_new' });

      let { agentService } = await import('./agent');

      await agentService.upsertAgent({
        tenant,
        solution,
        environment,
        input: { name: 'Support Bot', type: 'custom' as any }
      });

      let call = createIdentityActor.mock.calls[0]![0];
      expect(call.input._agentSlug).toMatch(/^support-bot-/);
      expect(call.input._agentType).toBe('custom');
      expect(call.input._agentHash).toBeDefined();
    });

    it('retries via the unique-constraint path when a concurrent insert wins the race', async () => {
      let existing = { id: 'agent_raced' };
      agentFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      createIdentityActor.mockRejectedValue({ code: 'P2002' });

      let { agentService } = await import('./agent');

      let result = await agentService.upsertAgent({
        tenant,
        solution,
        environment,
        input: { name: 'Support', type: 'custom' as any }
      });

      expect(result).toBe(existing);
      expect(agentFindUnique).toHaveBeenCalledTimes(2);
    });

    it('rethrows non-unique-constraint errors raised during creation', async () => {
      agentFindUnique.mockResolvedValueOnce(null);
      let boom = new Error('boom');
      createIdentityActor.mockRejectedValue(boom);

      let { agentService } = await import('./agent');

      await expect(
        agentService.upsertAgent({
          tenant,
          solution,
          environment,
          input: { name: 'Support', type: 'custom' as any }
        })
      ).rejects.toBe(boom);
    });
  });

  describe('archiveAgent', () => {
    it('checks tenant ownership and archives the underlying identity actor', async () => {
      identityActorFindFirstOrThrow.mockResolvedValue({ id: 'actor_50' });
      getIdentityActorById.mockResolvedValue({ id: 'actor_50' });
      archiveIdentityActor.mockResolvedValue({ oid: BigInt(50) });
      agentFindFirstOrThrow.mockResolvedValue({ id: 'agent_50', archivedAt: new Date() });

      let { agentService } = await import('./agent');

      let result = await agentService.archiveAgent({
        tenant,
        solution,
        environment,
        agent: { actorOid: BigInt(50) } as any
      });

      expect(checkTenantFn).toHaveBeenCalled();
      expect(archiveIdentityActor).toHaveBeenCalledWith(
        expect.objectContaining({ identityActor: { id: 'actor_50' } })
      );
      expect(result.id).toBe('agent_50');
    });
  });
});
