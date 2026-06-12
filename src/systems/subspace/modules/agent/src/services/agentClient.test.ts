import { beforeEach, describe, expect, it, vi } from 'vitest';

let agentClientFindFirst = vi.fn();
let agentClientFindMany = vi.fn();
let agentClientUpsert = vi.fn();
let agentClientRegistrationUpsert = vi.fn();
let voyagerSearch = vi.fn();
let indexAgentClientAdd = vi.fn();
let addAfterTransactionHookFn = vi.fn(async (cb: () => Promise<unknown>) => {
  await cb();
});

vi.mock('@metorial-subspace/db', () => ({
  db: {
    agentClient: {
      findFirst: agentClientFindFirst,
      findMany: agentClientFindMany,
      upsert: agentClientUpsert
    },
    agentClientRegistration: {
      upsert: agentClientRegistrationUpsert
    }
  },
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_1` }),
  withTransaction: async (fn: (db: any) => Promise<unknown>) =>
    await fn({
      agentClient: { upsert: agentClientUpsert },
      agentClientRegistration: { upsert: agentClientRegistrationUpsert }
    }),
  addAfterTransactionHook: addAfterTransactionHookFn
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

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: (filter: unknown) => filter
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: {
    record: {
      search: voyagerSearch
    }
  },
  voyagerIndex: {
    agentClient: { id: 'idx_agentClient' }
  },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('../queues/search/agentClient', () => ({
  indexAgentClientQueue: {
    add: indexAgentClientAdd
  }
}));

let tenant = { oid: BigInt(1), id: 'tenant_1' } as any;
let solution = { oid: 2 } as any;
let environment = { oid: BigInt(3) } as any;

describe('agentClientService', () => {
  beforeEach(() => {
    vi.resetModules();
    agentClientFindFirst.mockReset();
    agentClientFindMany.mockReset();
    agentClientFindMany.mockResolvedValue([]);
    agentClientUpsert.mockReset();
    agentClientRegistrationUpsert.mockReset();
    voyagerSearch.mockReset();
    indexAgentClientAdd.mockReset();
    addAfterTransactionHookFn.mockClear();
  });

  describe('listAgentClients', () => {
    it('scopes list queries by tenant, environment, and solution', async () => {
      let { agentClientService } = await import('./agentClient');

      let paginator = await agentClientService.listAgentClients({
        tenant,
        solution,
        environment
      });
      await paginator.run({});

      expect(agentClientFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantOid: tenant.oid,
            solutionOid: solution.oid,
            environmentOid: environment.oid
          })
        })
      );
    });

    it('treats a whitespace-only search string as no search', async () => {
      let { agentClientService } = await import('./agentClient');

      let paginator = await agentClientService.listAgentClients({
        tenant,
        solution,
        environment,
        search: '   '
      });
      await paginator.run({});

      expect(voyagerSearch).not.toHaveBeenCalled();
    });

    it('runs voyager search when a non-empty search string is provided', async () => {
      voyagerSearch.mockResolvedValue([{ documentId: 'ac_1' }]);

      let { agentClientService } = await import('./agentClient');

      let paginator = await agentClientService.listAgentClients({
        tenant,
        solution,
        environment,
        search: 'claude'
      });
      await paginator.run({});

      expect(voyagerSearch).toHaveBeenCalledWith({
        tenantId: tenant.id,
        sourceId: 'src_1',
        indexId: 'idx_agentClient',
        query: 'claude'
      });
    });
  });

  describe('getAgentClientById', () => {
    it('returns the client when found', async () => {
      let client = { id: 'ac_1', name: 'Claude' };
      agentClientFindFirst.mockResolvedValue(client);

      let { agentClientService } = await import('./agentClient');

      let result = await agentClientService.getAgentClientById({
        tenant,
        solution,
        environment,
        agentClientId: 'ac_1'
      });

      expect(result).toBe(client);
    });

    it('throws a ServiceError when the client is missing', async () => {
      agentClientFindFirst.mockResolvedValue(null);

      let { agentClientService } = await import('./agentClient');

      await expect(
        agentClientService.getAgentClientById({
          tenant,
          solution,
          environment,
          agentClientId: 'ac_missing'
        })
      ).rejects.toMatchObject({
        payload: { resource: 'agent.client', id: 'ac_missing', kind: 'not_found' }
      });
    });
  });

  describe('upsertAgentClient', () => {
    it('creates an OAuth registration alongside an mcp_client_oauth client', async () => {
      agentClientUpsert.mockResolvedValue({ id: 'agentClient_1', oid: BigInt(1) });
      agentClientRegistrationUpsert.mockResolvedValue({ id: 'reg_1' });

      let { agentClientService } = await import('./agentClient');

      let result = await agentClientService.upsertAgentClient({
        tenant,
        solution,
        environment,
        input: {
          name: 'Claude',
          type: 'mcp_client_oauth',
          foreignId: 'foreign_claude',
          oauthRegistrationId: 'oauth_reg_1'
        }
      });

      expect(agentClientRegistrationUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { oauthRegistrationId: 'oauth_reg_1' }
        })
      );
      expect(result.agentClientRegistration).toEqual({ id: 'reg_1' });
    });

    it('does not create a registration for system_client type', async () => {
      agentClientUpsert.mockResolvedValue({ id: 'agentClient_1', oid: BigInt(1) });

      let { agentClientService } = await import('./agentClient');

      let result = await agentClientService.upsertAgentClient({
        tenant,
        solution,
        environment,
        input: {
          name: 'Internal',
          type: 'system_client',
          foreignId: 'foreign_sys'
        }
      });

      expect(agentClientRegistrationUpsert).not.toHaveBeenCalled();
      expect(result.agentClientRegistration).toBeNull();
    });

    it('schedules indexing only when the upsert created a new client', async () => {
      agentClientUpsert.mockResolvedValue({ id: 'agentClient_1', oid: BigInt(1) });

      let { agentClientService } = await import('./agentClient');

      await agentClientService.upsertAgentClient({
        tenant,
        solution,
        environment,
        input: { name: 'Claude', type: 'system_client', foreignId: 'foreign_new' }
      });

      expect(addAfterTransactionHookFn).toHaveBeenCalled();
      expect(indexAgentClientAdd).toHaveBeenCalledWith({ agentClientId: 'agentClient_1' });
    });

    it('does not schedule indexing when the upsert returned an existing client', async () => {
      agentClientUpsert.mockResolvedValue({ id: 'agentClient_existing', oid: BigInt(9) });

      let { agentClientService } = await import('./agentClient');

      await agentClientService.upsertAgentClient({
        tenant,
        solution,
        environment,
        input: { name: 'Claude', type: 'system_client', foreignId: 'foreign_existing' }
      });

      expect(indexAgentClientAdd).not.toHaveBeenCalled();
    });
  });

  describe('createAgentClient', () => {
    it('delegates to upsertAgentClient', async () => {
      agentClientUpsert.mockResolvedValue({ id: 'agentClient_1', oid: BigInt(1) });

      let { agentClientService } = await import('./agentClient');

      let result = await agentClientService.createAgentClient({
        tenant,
        solution,
        environment,
        input: { name: 'Claude', type: 'system_client', foreignId: 'foreign_1' }
      });

      expect(result.agentClient).toEqual({ id: 'agentClient_1', oid: BigInt(1) });
    });
  });
});
