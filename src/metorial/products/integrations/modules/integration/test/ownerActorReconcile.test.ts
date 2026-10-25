import { beforeEach, describe, expect, it, vi } from 'vitest';

let { processors, db, metorialDb } = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();

  return {
    processors,
    db: {
      instance: { findUnique: vi.fn() },
      identityActor: { findUnique: vi.fn() },
      integrationInstance: { findUnique: vi.fn(), updateMany: vi.fn() },
      integrationSetupSession: { findUnique: vi.fn(), updateMany: vi.fn() }
    },
    metorialDb: {
      consumerActor: { findFirst: vi.fn() }
    }
  };
});

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn(() => ({})),
  dailyPacedDelay: vi.fn(() => ({})),
  createQueue: vi.fn((config: { name: string }) => ({
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn((handler: (data: any) => Promise<void>) => {
      processors.set(config.name, handler);
      return {};
    })
  }))
}));

vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn(() => ({}))
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('@metorial-subspace/module-tenant', () => ({ metorialDb }));

vi.mock('../src/env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

await import('../src/queues/ownerActor');

let runInstanceActor = (integrationInstanceId: string) =>
  processors.get('sub/int/ownerActor/integrationInstance/single')!({ integrationInstanceId });

let runSetupSessionOwner = (integrationSetupSessionId: string) =>
  processors.get('sub/int/ownerActor/integrationSetupSession/single')!({
    integrationSetupSessionId
  });

let portalBinding = {
  instanceOid: 40n,
  privateMetadata: { $owner: 'consumer', consumerProfileOid: '77', providerTemplateId: 'pt_1' }
};

let buildInstance = (overrides: Record<string, unknown> = {}) => ({
  oid: 10n,
  tenantOid: 1n,
  identityActorOid: null,
  identity: null,
  integrationSetupSessions: [portalBinding],
  ...overrides
});

describe('integration instance actor backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.instance.findUnique.mockResolvedValue({ id: 'ins_1' });
    metorialDb.consumerActor.findFirst.mockResolvedValue({ id: 'act_consumer' });
    db.identityActor.findUnique.mockImplementation(async ({ where }) =>
      where.id ? { oid: 500n } : { tenantOid: 1n }
    );
  });

  it("sets the consumer's default actor from the portal binding", async () => {
    db.integrationInstance.findUnique.mockResolvedValue(buildInstance());

    await runInstanceActor('ii_1');

    expect(metorialDb.consumerActor.findFirst).toHaveBeenCalledWith({
      where: { consumerProfileOid: 77n, isDefault: true, instance: { id: 'ins_1' } },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
      select: { id: true }
    });
    expect(db.integrationInstance.updateMany).toHaveBeenCalledWith({
      where: { oid: 10n, identityActorOid: null },
      data: { identityActorOid: 500n }
    });
  });

  it("uses the instance consumer's default actor for consumer id bindings", async () => {
    db.integrationInstance.findUnique.mockResolvedValue(
      buildInstance({
        integrationSetupSessions: [
          { instanceOid: 40n, privateMetadata: { $owner: 'consumer', consumerId: 'con_1' } }
        ]
      })
    );

    await runInstanceActor('ii_1');

    expect(metorialDb.consumerActor.findFirst).toHaveBeenCalledWith({
      where: { defaultForInstanceConsumer: { id: 'con_1' }, instance: { id: 'ins_1' } },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
      select: { id: true }
    });
    expect(metorialDb.consumerActor.findFirst).toHaveBeenCalledTimes(1);
    expect(db.integrationInstance.updateMany).toHaveBeenCalled();
  });

  it('falls back to a profile default before the instance consumer default is synced', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(
      buildInstance({
        integrationSetupSessions: [
          { instanceOid: 40n, privateMetadata: { $owner: 'consumer', consumerId: 'con_1' } }
        ]
      })
    );
    metorialDb.consumerActor.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'act_consumer' });

    await runInstanceActor('ii_1');

    expect(metorialDb.consumerActor.findFirst).toHaveBeenLastCalledWith({
      where: { instanceConsumer: { id: 'con_1' }, isDefault: true, instance: { id: 'ins_1' } },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
      select: { id: true }
    });
    expect(db.integrationInstance.updateMany).toHaveBeenCalledWith({
      where: { oid: 10n, identityActorOid: null },
      data: { identityActorOid: 500n }
    });
  });

  it('keeps an identity that already belongs to the consumer actor', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(
      buildInstance({ identity: { actorOid: 500n } })
    );

    await runInstanceActor('ii_1');

    expect(db.integrationInstance.updateMany).toHaveBeenCalled();
  });

  it('skips instances whose identity belongs to a different actor', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(
      buildInstance({ identity: { actorOid: 999n } })
    );

    await runInstanceActor('ii_1');

    expect(db.integrationInstance.updateMany).not.toHaveBeenCalled();
  });

  it('skips actors from another tenant', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(buildInstance({ tenantOid: 2n }));

    await runInstanceActor('ii_1');

    expect(db.integrationInstance.updateMany).not.toHaveBeenCalled();
  });

  it('leaves instances alone when the consumer has no actor yet', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(buildInstance());
    metorialDb.consumerActor.findFirst.mockResolvedValue(null);

    await runInstanceActor('ii_1');

    expect(db.integrationInstance.updateMany).not.toHaveBeenCalled();
  });

  it('never overwrites an existing actor', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(
      buildInstance({ identityActorOid: 123n })
    );

    await runInstanceActor('ii_1');

    expect(metorialDb.consumerActor.findFirst).not.toHaveBeenCalled();
    expect(db.integrationInstance.updateMany).not.toHaveBeenCalled();
  });

  it('ignores malformed consumer profile oids', async () => {
    db.integrationInstance.findUnique.mockResolvedValue(
      buildInstance({
        integrationSetupSessions: [
          {
            instanceOid: 40n,
            privateMetadata: { $owner: 'consumer', consumerProfileOid: 'x' }
          }
        ]
      })
    );

    await runInstanceActor('ii_1');

    expect(metorialDb.consumerActor.findFirst).not.toHaveBeenCalled();
    expect(db.integrationInstance.updateMany).not.toHaveBeenCalled();
  });
});

describe('integration setup session owner backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.instance.findUnique.mockResolvedValue({ id: 'ins_1' });
    metorialDb.consumerActor.findFirst.mockResolvedValue({ id: 'act_consumer' });
    db.identityActor.findUnique.mockResolvedValue({ oid: 500n });
  });

  it("prefers the integration instance's actor", async () => {
    db.integrationSetupSession.findUnique.mockResolvedValue({
      oid: 20n,
      ownerActorOid: null,
      ...portalBinding,
      integrationInstance: { identityActorOid: 300n }
    });

    await runSetupSessionOwner('iss_1');

    expect(metorialDb.consumerActor.findFirst).not.toHaveBeenCalled();
    expect(db.integrationSetupSession.updateMany).toHaveBeenCalledWith({
      where: { oid: 20n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 300n }
    });
  });

  it('falls back to the portal binding when the instance has no actor', async () => {
    db.integrationSetupSession.findUnique.mockResolvedValue({
      oid: 20n,
      ownerActorOid: null,
      ...portalBinding,
      integrationInstance: { identityActorOid: null }
    });

    await runSetupSessionOwner('iss_1');

    expect(db.integrationSetupSession.updateMany).toHaveBeenCalledWith({
      where: { oid: 20n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 500n }
    });
  });
});
