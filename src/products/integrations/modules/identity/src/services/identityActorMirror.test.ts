import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  identityActorFindUnique: vi.fn(),
  agentFindUnique: vi.fn(),
  environmentFindUnique: vi.fn(),
  instanceFindUnique: vi.fn(),
  metorialInstanceFindUnique: vi.fn(),
  metorialIdentityActorUpsert: vi.fn(),
  metorialIdentityActorUpdateMany: vi.fn(),
  metorialAgentUpsert: vi.fn(),
  metorialAgentUpdateMany: vi.fn(),
  metorialConsumerActorUpdateMany: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    identityActor: { findUnique: mocks.identityActorFindUnique },
    agent: { findUnique: mocks.agentFindUnique },
    environment: { findUnique: mocks.environmentFindUnique },
    instance: { findUnique: mocks.instanceFindUnique }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  metorialDb: {
    instance: { findUnique: mocks.metorialInstanceFindUnique },
    identityActor: {
      upsert: mocks.metorialIdentityActorUpsert,
      updateMany: mocks.metorialIdentityActorUpdateMany
    },
    agent: {
      upsert: mocks.metorialAgentUpsert,
      updateMany: mocks.metorialAgentUpdateMany
    },
    consumerActor: { updateMany: mocks.metorialConsumerActorUpdateMany }
  }
}));

import { identityActorMirrorService } from './identityActorMirror';

let createdAt = new Date('2026-01-01');
let updatedAt = new Date('2026-02-01');

let buildIdentityActor = (overrides: Record<string, unknown> = {}) => ({
  oid: 501n,
  id: 'act_1',
  type: 'consumer',
  status: 'active',
  name: 'Ada',
  instanceOid: 31n,
  environmentOid: 21n,
  createdAt,
  updatedAt,
  archivedAt: null,
  ...overrides
});

let mirroredActorData = {
  type: 'consumer',
  status: 'active',
  name: 'Ada',

  organizationOid: 1n,
  projectOid: 2n,
  instanceOid: 3n,

  createdAt,
  updatedAt,
  archivedAt: null
};

describe('identityActorMirrorService.syncIdentityActor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.instanceFindUnique.mockResolvedValue({ id: 'ins_1' });
    mocks.metorialInstanceFindUnique.mockResolvedValue({
      oid: 3n,
      projectOid: 2n,
      organizationOid: 1n
    });
    mocks.metorialIdentityActorUpsert.mockImplementation(async ({ create }) => create);
  });

  it('copies the id and oid into the core database and links the consumer actor', async () => {
    mocks.identityActorFindUnique.mockResolvedValue(buildIdentityActor());

    await identityActorMirrorService.syncIdentityActor({ identityActorId: 'act_1' });

    expect(mocks.metorialInstanceFindUnique).toHaveBeenCalledWith({
      where: { id: 'ins_1' },
      select: { oid: true, projectOid: true, organizationOid: true }
    });
    expect(mocks.metorialIdentityActorUpsert).toHaveBeenCalledWith({
      where: { id: 'act_1' },
      create: { oid: 501n, id: 'act_1', ...mirroredActorData },
      update: mirroredActorData
    });
    expect(mocks.metorialConsumerActorUpdateMany).toHaveBeenCalledWith({
      where: { id: 'act_1', identityActorOid: null },
      data: { identityActorOid: 501n }
    });
  });

  it("falls back to the environment's instance when the actor has none", async () => {
    mocks.identityActorFindUnique.mockResolvedValue(buildIdentityActor({ instanceOid: null }));
    mocks.environmentFindUnique.mockResolvedValue({ instanceOid: 32n });

    await identityActorMirrorService.syncIdentityActor({ identityActorId: 'act_1' });

    expect(mocks.instanceFindUnique).toHaveBeenCalledWith({
      where: { oid: 32n },
      select: { id: true }
    });
    expect(mocks.metorialIdentityActorUpsert).toHaveBeenCalled();
  });

  it('skips actors whose instance cannot be resolved', async () => {
    mocks.identityActorFindUnique.mockResolvedValue(buildIdentityActor({ instanceOid: null }));
    mocks.environmentFindUnique.mockResolvedValue({ instanceOid: null });

    let result = await identityActorMirrorService.syncIdentityActor({
      identityActorId: 'act_1'
    });

    expect(result).toBeNull();
    expect(mocks.metorialIdentityActorUpsert).not.toHaveBeenCalled();
  });

  it('marks the mirror deleted when the source actor no longer exists', async () => {
    mocks.identityActorFindUnique.mockResolvedValue(null);

    await identityActorMirrorService.syncIdentityActor({ identityActorId: 'act_1' });

    expect(mocks.metorialIdentityActorUpdateMany).toHaveBeenCalledWith({
      where: { id: 'act_1', status: { not: 'deleted' } },
      data: { status: 'deleted' }
    });
    expect(mocks.metorialIdentityActorUpsert).not.toHaveBeenCalled();
  });
});

describe('identityActorMirrorService.syncAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.instanceFindUnique.mockResolvedValue({ id: 'ins_1' });
    mocks.metorialInstanceFindUnique.mockResolvedValue({
      oid: 3n,
      projectOid: 2n,
      organizationOid: 1n
    });
    mocks.metorialIdentityActorUpsert.mockImplementation(async ({ create }) => create);
  });

  it('mirrors the actor first and links the agent to it', async () => {
    mocks.agentFindUnique.mockResolvedValue({
      oid: 701n,
      id: 'agt_1',
      type: 'mcp_client',
      status: 'active',
      name: 'Agent',
      actor: { id: 'act_1' },
      createdAt,
      updatedAt,
      archivedAt: null
    });
    mocks.identityActorFindUnique.mockResolvedValue(buildIdentityActor({ type: 'agent' }));

    await identityActorMirrorService.syncAgent({ agentId: 'agt_1' });

    expect(mocks.metorialIdentityActorUpsert).toHaveBeenCalled();
    expect(mocks.metorialAgentUpsert).toHaveBeenCalledWith({
      where: { id: 'agt_1' },
      create: expect.objectContaining({
        oid: 701n,
        id: 'agt_1',
        type: 'mcp_client',
        actorOid: 501n,
        organizationOid: 1n,
        projectOid: 2n,
        instanceOid: 3n
      }),
      update: expect.objectContaining({ actorOid: 501n, status: 'active' })
    });
  });

  it('marks the mirror deleted when the source agent no longer exists', async () => {
    mocks.agentFindUnique.mockResolvedValue(null);

    await identityActorMirrorService.syncAgent({ agentId: 'agt_1' });

    expect(mocks.metorialAgentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'agt_1', status: { not: 'deleted' } },
      data: { status: 'deleted' }
    });
    expect(mocks.metorialAgentUpsert).not.toHaveBeenCalled();
  });
});
