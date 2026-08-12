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
    findUnique: vi.fn()
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
    archiveIdentityActor: mocks.deleteIdentityActor
  },
  identityService: {
    getIdentityById: mocks.getIdentity,
    createIdentity: mocks.createIdentity,
    archiveIdentity: mocks.deleteIdentity
  }
}));

import { consumerActorService } from '../src/services/consumerEntities/consumerActor';

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

  it('returns a healthy existing default actor without taking the lock', async () => {
    mocks.consumerActor.findMany.mockResolvedValue([actor]);

    await expect(
      consumerActorService.ensureDefaultConsumerActor({ instance, consumerProfile })
    ).resolves.toBe(actor);

    expect(mocks.usingLock).not.toHaveBeenCalled();
    expect(mocks.createIdentityActor).not.toHaveBeenCalled();
  });

  it('creates the actor, default identity, and local record when missing', async () => {
    let result = await consumerActorService.ensureDefaultConsumerActor({
      instance,
      consumerProfile
    });

    expect(mocks.usingLock).toHaveBeenCalledWith('20', expect.any(Function));
    expect(mocks.createIdentityActor).toHaveBeenCalledWith(
      expect.objectContaining({
        instance,
        input: expect.objectContaining({ name: 'New Consumer', type: 'person' })
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
