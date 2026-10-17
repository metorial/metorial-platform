import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let agentClientUpsert = vi.fn();
  let agentClientRegistrationUpsert = vi.fn();
  let addAfterTransactionHook = vi.fn();
  let indexAgentClientQueueAdd = vi.fn();
  let mirrorAgentClientQueueAdd = vi.fn();

  let db = {
    agentClient: { upsert: agentClientUpsert },
    agentClientRegistration: { upsert: agentClientRegistrationUpsert }
  };

  return {
    db,
    agentClientUpsert,
    agentClientRegistrationUpsert,
    addAfterTransactionHook,
    indexAgentClientQueueAdd,
    mirrorAgentClientQueueAdd
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

vi.mock('../queues/mirror', () => ({
  mirrorAgentClientQueue: { add: mocks.mirrorAgentClientQueueAdd }
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

  it('queues the core mirror after a new client is created', async () => {
    await agentClientService.upsertAgentClientInternal({ tenant, environment, input });

    let hooks = mocks.addAfterTransactionHook.mock.calls.map(call => call[0]);
    for (let hook of hooks) await hook();

    expect(mocks.mirrorAgentClientQueueAdd).toHaveBeenCalledWith({ agentClientId: 'kac_new' });
  });

  it('does not requeue the mirror for an unchanged client', async () => {
    mocks.agentClientUpsert.mockResolvedValue({ oid: 9n, id: 'kac_existing' });

    await agentClientService.upsertAgentClientInternal({ tenant, environment, input });

    let hooks = mocks.addAfterTransactionHook.mock.calls.map(call => call[0]);
    for (let hook of hooks) await hook();

    expect(mocks.mirrorAgentClientQueueAdd).not.toHaveBeenCalled();
  });

  it('queues the core mirror when an existing client gets a new registration', async () => {
    mocks.agentClientUpsert.mockResolvedValue({ oid: 9n, id: 'kac_existing' });
    mocks.agentClientRegistrationUpsert.mockResolvedValue({ oid: 500n, id: 'kac_new' });

    await agentClientService.upsertAgentClientInternal({
      tenant,
      environment,
      input: {
        name: 'Probe',
        type: 'mcp_client_oauth',
        foreignId: 'fid_1',
        oauthRegistrationId: 'cac_1'
      }
    });

    let hooks = mocks.addAfterTransactionHook.mock.calls.map(call => call[0]);
    for (let hook of hooks) await hook();

    expect(mocks.mirrorAgentClientQueueAdd).toHaveBeenCalledWith({
      agentClientId: 'kac_existing'
    });
  });
});
