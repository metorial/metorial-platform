import { beforeEach, describe, expect, it, vi } from 'vitest';

let agentInstanceFindFirst = vi.fn();
let agentInstanceFindMany = vi.fn();
let agentInstanceUpsert = vi.fn();
let checkTenantFn = vi.fn();
let checkDeletedRelationFn = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    agentInstance: {
      findFirst: agentInstanceFindFirst,
      findMany: agentInstanceFindMany,
      upsert: agentInstanceUpsert
    }
  },
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` }),
  withTransaction: async (fn: (db: any) => Promise<unknown>) =>
    await fn({
      agentInstance: { upsert: agentInstanceUpsert }
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

vi.mock('@lowerdeck/hash', () => ({
  Hash: {
    sha256: vi.fn(async (input: string) => `hash_${input.length}`)
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

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: (filter: unknown) => filter,
  checkDeletedRelation: checkDeletedRelationFn
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: checkTenantFn
}));

let tenant = { oid: BigInt(1), id: 'tenant_1' } as any;
let solution = { oid: 2 } as any;
let environment = { oid: BigInt(3) } as any;

let agent = {
  oid: BigInt(10),
  id: 'agent_1',
  type: 'custom',
  isParentDeleted: false
} as any;

describe('agentInstanceService', () => {
  beforeEach(() => {
    vi.resetModules();
    agentInstanceFindFirst.mockReset();
    agentInstanceFindMany.mockReset();
    agentInstanceFindMany.mockResolvedValue([]);
    agentInstanceUpsert.mockReset();
    checkTenantFn.mockReset();
    checkDeletedRelationFn.mockReset();
  });

  describe('listAgentInstances', () => {
    it('checks tenant ownership of the agent and scopes the query by agentOid', async () => {
      let { agentInstanceService } = await import('./agentInstance');

      let paginator = await agentInstanceService.listAgentInstances({
        tenant,
        solution,
        environment,
        agent
      });
      await paginator.run({});

      expect(checkTenantFn).toHaveBeenCalledWith(expect.objectContaining({ tenant }), agent);
      expect(agentInstanceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentOid: agent.oid })
        })
      );
    });

    it('passes through id, type, and agentClient filters', async () => {
      let { agentInstanceService } = await import('./agentInstance');

      let paginator = await agentInstanceService.listAgentInstances({
        tenant,
        solution,
        environment,
        agent,
        ids: ['ai_1'],
        types: ['mcp_client'] as any,
        agentClientIds: ['ac_1']
      });
      await paginator.run({});

      let call = agentInstanceFindMany.mock.calls[0]![0];
      expect(call.where.AND).toEqual(
        expect.arrayContaining([
          { id: { in: ['ai_1'] } },
          { type: { in: ['mcp_client'] } },
          { agentClient: { id: { in: ['ac_1'] } } }
        ])
      );
    });
  });

  describe('getAgentInstanceById', () => {
    it('returns the instance when found', async () => {
      let instance = { id: 'ai_1' };
      agentInstanceFindFirst.mockResolvedValue(instance);

      let { agentInstanceService } = await import('./agentInstance');

      let result = await agentInstanceService.getAgentInstanceById({
        tenant,
        solution,
        environment,
        agent,
        agentInstanceId: 'ai_1'
      });

      expect(checkTenantFn).toHaveBeenCalledWith(expect.objectContaining({ tenant }), agent);
      expect(result).toBe(instance);
    });

    it('throws a ServiceError when the instance is missing', async () => {
      agentInstanceFindFirst.mockResolvedValue(null);

      let { agentInstanceService } = await import('./agentInstance');

      await expect(
        agentInstanceService.getAgentInstanceById({
          tenant,
          solution,
          environment,
          agent,
          agentInstanceId: 'ai_missing'
        })
      ).rejects.toMatchObject({
        payload: { resource: 'agent.instance', id: 'ai_missing', kind: 'not_found' }
      });
    });
  });

  describe('upsertAgentInstance', () => {
    it('rejects when the registration belongs to a different client', async () => {
      let { agentInstanceService } = await import('./agentInstance');

      await expect(
        agentInstanceService.upsertAgentInstance({
          tenant,
          solution,
          environment,
          agent,
          agentClient: { oid: BigInt(5) } as any,
          agentClientRegistration: { agentClientOid: BigInt(99) } as any,
          input: { name: 'instance', type: 'mcp_client' as any }
        })
      ).rejects.toMatchObject({
        payload: expect.objectContaining({ kind: 'bad_request' })
      });
    });

    it('rejects tool_call agents that receive a non-tool_call instance type', async () => {
      let { agentInstanceService } = await import('./agentInstance');

      await expect(
        agentInstanceService.upsertAgentInstance({
          tenant,
          solution,
          environment,
          agent: { ...agent, type: 'tool_call' } as any,
          input: { name: 'instance', type: 'mcp_client' as any }
        })
      ).rejects.toMatchObject({
        payload: expect.objectContaining({ kind: 'bad_request' })
      });
    });

    it('hashes input + agent context and upserts using agentOid_hash', async () => {
      agentInstanceUpsert.mockResolvedValue({ id: 'ai_new' });

      let { agentInstanceService } = await import('./agentInstance');

      let result = await agentInstanceService.upsertAgentInstance({
        tenant,
        solution,
        environment,
        agent,
        input: { name: 'instance', version: '1.0.0', type: 'mcp_client' as any }
      });

      expect(checkTenantFn).toHaveBeenCalled();
      expect(checkDeletedRelationFn).toHaveBeenCalledWith(agent);
      let call = agentInstanceUpsert.mock.calls[0]![0];
      expect(call.where).toEqual({
        agentOid_hash: {
          agentOid: agent.oid,
          hash: expect.stringMatching(/^hash_/)
        }
      });
      expect(call.create).toEqual(
        expect.objectContaining({
          name: 'instance',
          version: '1.0.0',
          type: 'mcp_client',
          agentOid: agent.oid
        })
      );
      expect(result).toEqual({ id: 'ai_new' });
    });
  });
});
