import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => import('../../../../../../db/src/lib/unique'));

let mocks = vi.hoisted(() => ({
  db: {
    agentInstance: { findUnique: vi.fn(), update: vi.fn() }
  },
  transactionDb: {
    agentInstance: { upsert: vi.fn() }
  },
  inTransaction: false,
  addAfterTransactionHook: vi.fn(),
  mirrorAgentInstanceQueueAdd: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: vi.fn((_name, factory) => ({ build: () => factory() })) }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: vi.fn(() => ({ oid: 500n, id: 'agi_new' })),
  withTransaction: vi.fn(async run => {
    mocks.inTransaction = true;

    try {
      return await run(mocks.transactionDb);
    } finally {
      mocks.inTransaction = false;
    }
  }),
  addAfterTransactionHook: mocks.addAfterTransactionHook
}));

vi.mock('@metorial-subspace/list-utils', () => ({ checkDeletedRelation: vi.fn() }));

vi.mock('@metorial-subspace/module-tenant', () => ({ checkTenant: vi.fn() }));

vi.mock('../queues/mirror', () => ({
  mirrorAgentInstanceQueue: { add: mocks.mirrorAgentInstanceQueueAdd }
}));

import { agentInstanceService, type UpsertAgentInstanceParams } from './agentInstance';

let params = {
  tenant: { oid: 1n },
  environment: { oid: 2n },
  agent: { oid: 3n, id: 'agt_1', type: 'mcp_client' },
  agentClient: { oid: 4n, id: 'agc_1' },
  agentClientRegistration: { oid: 5n, id: 'agr_1', agentClientOid: 4n },
  input: {
    name: ' Probe ',
    version: ' 1.0 ',
    description: ' Updated description ',
    type: 'mcp_client'
  }
} as UpsertAgentInstanceParams;

let existing = {
  oid: 99n,
  id: 'agi_existing',
  description: 'Updated description',
  lastConnectedAt: new Date()
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.agentInstance.findUnique.mockResolvedValue(null);
  mocks.transactionDb.agentInstance.upsert.mockResolvedValue({ oid: 500n, id: 'agi_new' });
});

describe('agent instance upsert', () => {
  it('returns a recently connected, unchanged instance without writing', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue(existing);

    let result = await agentInstanceService.upsertAgentInstanceInternal(params);

    expect(result).toBe(existing);
    expect(mocks.transactionDb.agentInstance.upsert).not.toHaveBeenCalled();
    expect(mocks.db.agentInstance.update).not.toHaveBeenCalled();
  });

  it('queues the mirror after creating a new instance', async () => {
    await agentInstanceService.upsertAgentInstanceInternal(params);

    expect(mocks.addAfterTransactionHook).toHaveBeenCalledTimes(1);
    await mocks.addAfterTransactionHook.mock.calls[0]![0]();

    expect(mocks.mirrorAgentInstanceQueueAdd).toHaveBeenCalledWith({
      agentInstanceId: 'agi_new'
    });
  });

  it('refreshes an existing instance after the write interval without requeuing its mirror', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue({
      ...existing,
      lastConnectedAt: new Date(Date.now() - 60_000)
    });
    mocks.transactionDb.agentInstance.upsert.mockResolvedValue(existing);

    expect(await agentInstanceService.upsertAgentInstanceInternal(params)).toBe(existing);
    expect(mocks.transactionDb.agentInstance.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.addAfterTransactionHook).not.toHaveBeenCalled();
  });

  it('recovers a concurrent insert by the compound key after the failed transaction exits', async () => {
    mocks.transactionDb.agentInstance.upsert.mockRejectedValueOnce(
      Object.assign(new Error('duplicate agentOid/hash'), { code: 'P2002' })
    );
    mocks.db.agentInstance.update.mockImplementationOnce(async () => {
      expect(mocks.inTransaction).toBe(false);
      return existing;
    });

    let result = await agentInstanceService.upsertAgentInstanceInternal(params);

    let upsert = mocks.transactionDb.agentInstance.upsert.mock.calls[0]![0];
    expect(result).toBe(existing);
    expect(upsert.where).toEqual({
      agentOid_hash: { agentOid: 3n, hash: expect.any(String) }
    });
    expect(mocks.db.agentInstance.update).toHaveBeenCalledExactlyOnceWith({
      where: upsert.where,
      data: upsert.update,
      include: upsert.include
    });
    expect(upsert.update).toEqual({
      name: 'Probe',
      version: '1.0',
      description: 'Updated description',
      type: 'mcp_client',
      lastConnectedAt: expect.any(Date),
      agentClientOid: 4n,
      agentClientRegistrationOid: 5n
    });
    expect(upsert.include).toEqual({
      agent: true,
      agentClient: true,
      agentClientRegistration: true
    });
    expect(mocks.addAfterTransactionHook).not.toHaveBeenCalled();
  });

  it('preserves the original unique error if there is no row matching the compound key', async () => {
    let error = Object.assign(new Error('duplicate id'), { code: 'P2002' });
    mocks.transactionDb.agentInstance.upsert.mockRejectedValueOnce(error);
    mocks.db.agentInstance.update.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'P2025' })
    );

    await expect(agentInstanceService.upsertAgentInstanceInternal(params)).rejects.toBe(error);
    expect(mocks.addAfterTransactionHook).not.toHaveBeenCalled();
  });

  it('propagates non-unique failures without attempting recovery', async () => {
    let error = Object.assign(new Error('foreign key'), { code: 'P2003' });
    mocks.transactionDb.agentInstance.upsert.mockRejectedValueOnce(error);

    await expect(agentInstanceService.upsertAgentInstanceInternal(params)).rejects.toBe(error);
    expect(mocks.db.agentInstance.update).not.toHaveBeenCalled();
  });

  it('propagates unexpected recovery failures', async () => {
    mocks.transactionDb.agentInstance.upsert.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'P2002' })
    );
    let error = new Error('database unavailable');
    mocks.db.agentInstance.update.mockRejectedValueOnce(error);

    await expect(agentInstanceService.upsertAgentInstanceInternal(params)).rejects.toBe(error);
  });
});
