import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let agentClientUpsert = vi.fn();
  let agentClientFindUnique = vi.fn();
  let agentClientRegistrationUpsert = vi.fn();
  let addAfterTransactionHook = vi.fn();
  let indexAgentClientQueueAdd = vi.fn();

  let db = {
    agentClient: { upsert: agentClientUpsert, findUnique: agentClientFindUnique },
    agentClientRegistration: { upsert: agentClientRegistrationUpsert }
  };

  return {
    db,
    agentClientUpsert,
    agentClientFindUnique,
    agentClientRegistrationUpsert,
    addAfterTransactionHook,
    indexAgentClientQueueAdd
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: vi.fn(() => ({ oid: 500n, id: 'kac_new' })),
  withTransaction: vi.fn(async (run: any) => run(mocks.db)),
  addAfterTransactionHook: mocks.addAfterTransactionHook
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: { record: { search: vi.fn() } },
  voyagerIndex: { agentClient: { id: 'idx_agent_client' } },
  voyagerSource: Promise.resolve({ id: 'src_1' })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 7 })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../queues/search/agentClient', () => ({
  indexAgentClientQueue: { add: mocks.indexAgentClientQueueAdd }
}));

import { agentClientService } from './agentClient';

let tenant = { oid: 1n, id: 'ktn_1', projectOid: 2n } as any;
let environment = { oid: 3n, id: 'ken_1', instanceOid: 4n } as any;

let input = {
  name: 'Probe',
  type: 'system_client' as const,
  foreignId: 'fid_1'
};

describe('Agent client double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agentClientUpsert.mockResolvedValue({ oid: 500n, id: 'kac_new' });
    mocks.agentClientFindUnique.mockResolvedValue(null);
  });

  let existingClient = {
    oid: 9n,
    id: 'kac_existing',
    name: 'Probe',
    type: 'system_client',
    privateMetadata: null,
    tenantOid: 1n,
    projectOid: 2n,
    solutionOid: 7,
    environmentOid: 3n,
    instanceOid: 4n,
    lastConnectedAt: new Date()
  };

  it('returns a recently connected, unchanged client without writing', async () => {
    mocks.agentClientFindUnique.mockResolvedValue(existingClient);

    let result = await agentClientService.upsertAgentClientInternal({
      tenant,
      environment,
      input
    });

    expect(result).toEqual({ agentClient: existingClient, agentClientRegistration: null });
    expect(mocks.agentClientUpsert).not.toHaveBeenCalled();
  });

  it('refreshes lastConnectedAt once the write interval has passed', async () => {
    mocks.agentClientFindUnique.mockResolvedValue({
      ...existingClient,
      lastConnectedAt: new Date(Date.now() - 60_000)
    });

    await agentClientService.upsertAgentClientInternal({ tenant, environment, input });

    expect(mocks.agentClientUpsert).toHaveBeenCalledTimes(1);
  });

  it('mirrors the tenant and environment oids in both upsert branches', async () => {
    await agentClientService.upsertAgentClientInternal({ tenant, environment, input });

    expect(mocks.agentClientUpsert).toHaveBeenCalledTimes(1);
    let call = mocks.agentClientUpsert.mock.calls[0][0];

    expect(call.create).toMatchObject({
      tenantOid: 1n,
      projectOid: 2n,
      environmentOid: 3n,
      instanceOid: 4n
    });
    expect(call.update).toMatchObject({
      tenantOid: 1n,
      projectOid: 2n,
      environmentOid: 3n,
      instanceOid: 4n
    });
  });

  it('mirrors null references while the backfill is still pending', async () => {
    await agentClientService.upsertAgentClientInternal({
      tenant: { ...tenant, projectOid: null },
      environment: { ...environment, instanceOid: null },
      input
    });

    let call = mocks.agentClientUpsert.mock.calls[0][0];

    expect(call.create.projectOid).toBeNull();
    expect(call.create.instanceOid).toBeNull();
    expect(call.update.projectOid).toBeNull();
    expect(call.update.instanceOid).toBeNull();
  });

  it('keeps the lookup on the legacy source of truth', async () => {
    await agentClientService.upsertAgentClientInternal({ tenant, environment, input });

    let call = mocks.agentClientUpsert.mock.calls[0][0];

    expect(call.where).toEqual({ foreignId: 'fid_1' });
  });
});
