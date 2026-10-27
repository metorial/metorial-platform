import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  usingLock: vi.fn(async (_key: string, fn: () => Promise<unknown>) => await fn()),
  captureException: vi.fn(),
  getIdentityActor: vi.fn(),
  createIdentityActor: vi.fn(),
  updateIdentityActor: vi.fn(),
  deleteIdentityActor: vi.fn(),
  getIdentity: vi.fn(),
  createIdentity: vi.fn(),
  deleteIdentity: vi.fn(),
  syncConsumerProfile: vi.fn(),
  syncConsumerOwnership: vi.fn(),
  setInstanceConsumerDefaultActor: vi.fn(),
  syncMirroredIdentityActor: vi.fn(),
  enqueueInstanceConsumerSync: vi.fn(),
  consumerActor: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  consumerProfile: {
    findFirst: vi.fn()
  },
  instanceConsumer: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn()
  }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({ usingLock: mocks.usingLock }))
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => ({ captureException: mocks.captureException }))
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/error', () => ({
  notFoundError: vi.fn((entity: string) => ({ entity })),
  ServiceError: class ServiceError extends Error {
    constructor(public detail: unknown) {
      super('Service error');
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerActor: mocks.consumerActor,
    consumerProfile: mocks.consumerProfile,
    instanceConsumer: mocks.instanceConsumer
  },
  withTransaction: vi.fn(async fn =>
    fn({
      consumerActor: mocks.consumerActor,
      consumerProfile: mocks.consumerProfile,
      instanceConsumer: mocks.instanceConsumer
    })
  )
}));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityActorService: {
    getIdentityActorById: mocks.getIdentityActor,
    createIdentityActor: mocks.createIdentityActor,
    updateIdentityActor: mocks.updateIdentityActor,
    archiveIdentityActor: mocks.deleteIdentityActor,
    syncConsumerOwnershipInternal: mocks.syncConsumerOwnership,
    setInstanceConsumerDefaultActorInternal: mocks.setInstanceConsumerDefaultActor
  },
  identityActorMirrorService: {
    syncIdentityActor: mocks.syncMirroredIdentityActor
  },
  identityService: {
    getIdentityById: mocks.getIdentity,
    createIdentity: mocks.createIdentity,
    archiveIdentity: mocks.deleteIdentity
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  metorialResourceService: {
    syncConsumerProfile: mocks.syncConsumerProfile
  }
}));

vi.mock('../src/queues/deletedConsumerProfile', () => ({
  archiveDeletedConsumerProfileActorsQueue: { add: vi.fn() }
}));

vi.mock('../src/queues/consumerActorSync', () => ({
  syncInstanceConsumerActorsQueue: {
    add: mocks.enqueueInstanceConsumerSync
  }
}));

import { consumerActorService } from '../src/services/consumerActor';

let instance = { id: 'ins_1', oid: 10n } as any;
let consumerProfile = { oid: 20n, instanceOid: 10n } as any;
let actor = {
  oid: 30n,
  id: 'act_1',
  instanceOid: 10n,
  consumerProfileOid: 20n,
  isDefault: true,
  defaultIdentityId: 'idt_1',
  createdAt: new Date('2026-01-01')
} as any;
let profile = {
  id: 'cop_1',
  oid: 20n,
  status: 'active',
  instanceOid: 10n,
  organizationOid: 40n,
  consumerOid: 50n,
  instance,
  consumer: { id: 'con_1' },
  actors: []
} as any;
let instanceConsumer = {
  id: 'ico_1',
  oid: 60n,
  name: 'New Consumer'
} as any;

describe('consumerActorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerActor.findMany.mockResolvedValue([]);
    mocks.consumerProfile.findFirst.mockResolvedValue(profile);
    mocks.instanceConsumer.findUnique.mockResolvedValue(instanceConsumer);
    mocks.consumerActor.updateMany.mockResolvedValue({ count: 0 });
    mocks.getIdentityActor.mockImplementation(async ({ identityActorId }) => ({
      id: identityActorId
    }));
    mocks.createIdentityActor.mockResolvedValue({ id: 'act_new' });
    mocks.getIdentity.mockImplementation(async ({ identityId }) => ({ id: identityId }));
    mocks.createIdentity.mockResolvedValue({ id: 'idt_new' });
    mocks.consumerActor.create.mockImplementation(async ({ data }) => ({
      oid: 70n,
      createdAt: new Date(),
      ...data
    }));
    mocks.consumerActor.update.mockImplementation(async ({ data }) => ({
      ...actor,
      ...data
    }));
    mocks.deleteIdentity.mockResolvedValue({});
    mocks.deleteIdentityActor.mockResolvedValue({});
  });

  it('rejects a deleted profile even if its default actor still exists', async () => {
    mocks.consumerProfile.findFirst.mockResolvedValue(null);
    mocks.consumerActor.findMany.mockResolvedValue([actor]);
    await expect(
      consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile })
    ).rejects.toThrow();
    expect(mocks.createIdentityActor).not.toHaveBeenCalled();
    expect(mocks.consumerActor.findMany).not.toHaveBeenCalled();
  });

  it('returns a healthy existing default actor without taking the lock', async () => {
    mocks.consumerActor.findMany.mockResolvedValue([actor]);

    await expect(
      consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile })
    ).resolves.toBe(actor);

    expect(mocks.usingLock).not.toHaveBeenCalled();
    expect(mocks.createIdentityActor).not.toHaveBeenCalled();
  });

  it('creates organization member actors with their own identity type', async () => {
    mocks.consumerProfile.findFirst.mockResolvedValue({
      ...profile,
      organizationMemberOid: 90n
    });

    await consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile });

    expect(mocks.createIdentityActor).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ type: 'organization_member' })
      })
    );
  });

  it('creates the actor, default identity, and local record when missing', async () => {
    let result = await consumerActorService.ensureDefaultConsumerActor({
      instance,
      consumerProfile
    });

    expect(mocks.usingLock).toHaveBeenCalledWith('20', expect.any(Function));
    expect(mocks.syncConsumerProfile).toHaveBeenCalledWith(profile);
    expect(mocks.createIdentityActor).toHaveBeenCalledWith(
      expect.objectContaining({
        instance,
        consumerOwner: {
          consumerId: 'con_1',
          instanceConsumerId: 'ico_1',
          consumerProfileId: 'cop_1'
        },
        input: expect.objectContaining({ name: 'New Consumer', type: 'consumer' })
      })
    );
    expect(mocks.createIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ id: 'act_new' }),
        input: expect.objectContaining({ inputs: [] })
      })
    );
    expect(mocks.consumerActor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'act_new',
        defaultIdentityId: 'idt_new',
        consumerProfileOid: 20n,
        isDefault: true
      })
    });
    expect(result.id).toBe('act_new');
    expect(mocks.enqueueInstanceConsumerSync).toHaveBeenCalledWith({
      instanceConsumerId: 'ico_1'
    });
  });

  it('rechecks inside the lock and uses an actor created by a concurrent caller', async () => {
    mocks.consumerProfile.findFirst.mockResolvedValue({
      ...profile,
      actors: [actor]
    });

    await expect(
      consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile })
    ).resolves.toBe(actor);

    expect(mocks.usingLock).toHaveBeenCalledTimes(1);
    expect(mocks.createIdentityActor).not.toHaveBeenCalled();
    expect(mocks.consumerActor.create).not.toHaveBeenCalled();
  });

  it('creates a default actor when only non-default actors exist', async () => {
    mocks.consumerProfile.findFirst.mockResolvedValue({
      ...profile,
      actors: []
    });

    await consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile });

    expect(mocks.createIdentityActor).toHaveBeenCalledTimes(1);
    expect(mocks.consumerActor.create).toHaveBeenCalledTimes(1);
  });

  it('repairs a missing default identity and demotes duplicate defaults', async () => {
    let partial = { ...actor, defaultIdentityId: null };
    let duplicate = { ...actor, oid: 31n, id: 'act_2', defaultIdentityId: 'idt_2' };
    mocks.consumerActor.findMany.mockResolvedValue([partial, duplicate]);
    mocks.consumerProfile.findFirst.mockResolvedValue({
      ...profile,
      actors: [partial, duplicate]
    });

    let result = await consumerActorService.ensureDefaultConsumerActor({
      instance,
      consumerProfile
    });

    expect(mocks.consumerActor.updateMany).toHaveBeenCalledWith({
      where: {
        oid: { in: [31n] },
        consumerProfileOid: 20n,
        isDefault: true
      },
      data: { isDefault: false }
    });
    expect(mocks.createIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ actor: expect.objectContaining({ id: 'act_1' }) })
    );
    expect(result.defaultIdentityId).toBe('idt_new');
  });

  it('uses a winner created during a local persistence race and cleans up its artifacts', async () => {
    mocks.consumerActor.create.mockRejectedValue(new Error('write lost'));
    mocks.consumerActor.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([actor]);

    await expect(
      consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile })
    ).resolves.toBe(actor);

    expect(mocks.deleteIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ id: 'idt_new' }),
        canEditConsumerActor: true
      })
    );
    expect(mocks.deleteIdentityActor).toHaveBeenCalledWith(
      expect.objectContaining({
        identityActor: expect.objectContaining({ id: 'act_new' }),
        canEditConsumerActor: true
      })
    );
  });

  it('preserves the provisioning error when cleanup also fails', async () => {
    let provisioningError = new Error('identity failed');
    let cleanupError = new Error('cleanup failed');
    mocks.createIdentity.mockRejectedValue(provisioningError);
    mocks.deleteIdentityActor.mockRejectedValue(cleanupError);

    await expect(
      consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile })
    ).rejects.toBe(provisioningError);

    expect(mocks.captureException).toHaveBeenCalledWith(cleanupError);
  });
});

describe('consumerActorService.syncInstanceConsumerActors', () => {
  let buildConsumerActor = (d: {
    oid: bigint;
    surfaceType: 'portal' | 'cli' | 'organization_members';
    createdAt: string;
    profileStatus?: 'active' | 'deleted';
    defaultForInstanceConsumerOid?: bigint | null;
    identityActorOid?: bigint | null;
  }) => ({
    oid: d.oid,
    id: `act_${d.oid}`,
    defaultIdentityId: `idt_${d.oid}`,
    identityActorOid: d.identityActorOid ?? null,
    defaultForInstanceConsumerOid: d.defaultForInstanceConsumerOid ?? null,
    createdAt: new Date(d.createdAt),
    consumerProfile: {
      oid: d.oid + 100n,
      id: `cop_${d.oid}`,
      status: d.profileStatus ?? 'active',
      surface: { type: d.surfaceType }
    }
  });

  let syncWith = async (consumerActors: ReturnType<typeof buildConsumerActor>[]) => {
    mocks.instanceConsumer.findUnique.mockResolvedValue({
      id: 'ico_1',
      oid: 60n,
      consumer: { id: 'con_1' },
      consumerActors
    });

    return await consumerActorService.syncInstanceConsumerActors({
      instanceConsumerId: 'ico_1'
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerActor.updateMany.mockResolvedValue({ count: 0 });
    mocks.consumerActor.update.mockResolvedValue({});
    mocks.syncConsumerOwnership.mockImplementation(async ({ defaultIdentityId }) => ({
      identityActor: { status: 'active' },
      defaultIdentityId
    }));
  });

  it('prefers a portal profile actor over an older organization member actor', async () => {
    let result = await syncWith([
      buildConsumerActor({
        oid: 1n,
        surfaceType: 'organization_members',
        createdAt: '2026-01-01'
      }),
      buildConsumerActor({ oid: 2n, surfaceType: 'portal', createdAt: '2026-02-01' })
    ]);

    expect(result?.id).toBe('act_2');
    expect(mocks.consumerActor.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { defaultForInstanceConsumerOid: 60n }
    });
    expect(mocks.setInstanceConsumerDefaultActor).toHaveBeenCalledWith({
      instanceConsumerId: 'ico_1',
      identityActorId: 'act_2'
    });
  });

  it('mirrors identity actors that are not yet linked in the core database', async () => {
    await syncWith([
      buildConsumerActor({ oid: 1n, surfaceType: 'portal', createdAt: '2026-01-01' }),
      buildConsumerActor({
        oid: 2n,
        surfaceType: 'cli',
        createdAt: '2026-01-02',
        identityActorOid: 900n
      })
    ]);

    expect(mocks.syncMirroredIdentityActor).toHaveBeenCalledTimes(1);
    expect(mocks.syncMirroredIdentityActor).toHaveBeenCalledWith({
      identityActorId: 'act_1'
    });
  });

  it('picks the oldest actor within the same surface type', async () => {
    let result = await syncWith([
      buildConsumerActor({ oid: 3n, surfaceType: 'portal', createdAt: '2026-03-01' }),
      buildConsumerActor({ oid: 4n, surfaceType: 'portal', createdAt: '2026-01-01' })
    ]);

    expect(result?.id).toBe('act_4');
  });

  it('links every actor to the instance consumer and its own profile', async () => {
    await syncWith([
      buildConsumerActor({ oid: 1n, surfaceType: 'portal', createdAt: '2026-01-01' }),
      buildConsumerActor({ oid: 2n, surfaceType: 'cli', createdAt: '2026-01-02' })
    ]);

    expect(mocks.syncConsumerProfile).toHaveBeenCalledTimes(2);
    expect(mocks.syncConsumerOwnership).toHaveBeenCalledWith({
      identityActorId: 'act_2',
      owner: { consumerId: 'con_1', instanceConsumerId: 'ico_1', consumerProfileId: 'cop_2' },
      defaultIdentityId: 'idt_2'
    });
  });

  it('skips deleted profiles and missing identity actors when choosing the default', async () => {
    mocks.syncConsumerOwnership.mockImplementation(
      async ({ identityActorId, defaultIdentityId }) =>
        identityActorId === 'act_2'
          ? null
          : { identityActor: { status: 'active' }, defaultIdentityId }
    );

    let result = await syncWith([
      buildConsumerActor({
        oid: 1n,
        surfaceType: 'portal',
        createdAt: '2026-01-01',
        profileStatus: 'deleted'
      }),
      buildConsumerActor({ oid: 2n, surfaceType: 'portal', createdAt: '2026-01-02' }),
      buildConsumerActor({
        oid: 3n,
        surfaceType: 'organization_members',
        createdAt: '2026-01-03'
      })
    ]);

    expect(result?.id).toBe('act_3');
  });

  it('persists a default identity resolved from the integrations database', async () => {
    mocks.syncConsumerOwnership.mockResolvedValue({
      identityActor: { status: 'active' },
      defaultIdentityId: 'idt_oldest'
    });

    await syncWith([
      buildConsumerActor({ oid: 1n, surfaceType: 'portal', createdAt: '2026-01-01' })
    ]);

    expect(mocks.consumerActor.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { defaultIdentityId: 'idt_oldest' }
    });
  });

  it('clears the default when no actor is eligible', async () => {
    let result = await syncWith([
      buildConsumerActor({
        oid: 1n,
        surfaceType: 'portal',
        createdAt: '2026-01-01',
        profileStatus: 'deleted',
        defaultForInstanceConsumerOid: 60n
      })
    ]);

    expect(result).toBeNull();
    expect(mocks.consumerActor.updateMany).toHaveBeenCalledWith({
      where: { defaultForInstanceConsumerOid: 60n, oid: undefined },
      data: { defaultForInstanceConsumerOid: null }
    });
    expect(mocks.setInstanceConsumerDefaultActor).toHaveBeenCalledWith({
      instanceConsumerId: 'ico_1',
      identityActorId: null
    });
  });
});
