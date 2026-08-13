import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  consumerProfileFindMany: vi.fn(),
  consumerProfileFindUnique: vi.fn(),
  reconcileProfile: vi.fn(),
  queueAdds: new Map<string, ReturnType<typeof vi.fn>>(),
  queueAddMany: new Map<string, ReturnType<typeof vi.fn>>(),
  queueProcessors: new Map<string, (data: any) => Promise<unknown>>()
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerProfile: {
      findMany: mocks.consumerProfileFindMany,
      findUnique: mocks.consumerProfileFindUnique
    }
  }
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_config, handler) => handler)
}));

vi.mock('@metorial/queue', () => ({
  combineQueueProcessors: vi.fn(processors => processors),
  createQueue: vi.fn(config => {
    let add = vi.fn();
    let addManyWithOps = vi.fn();
    mocks.queueAdds.set(config.name, add);
    mocks.queueAddMany.set(config.name, addManyWithOps);

    return {
      add,
      addManyWithOps,
      process: vi.fn(handler => {
        mocks.queueProcessors.set(config.name, handler);
        return handler;
      })
    };
  })
}));

vi.mock('../src/services', () => ({
  consumerProfileService: {
    reconcileConsumerProfileOrganizationActor: mocks.reconcileProfile
  }
}));

describe('reconcile consumer profile organization actors queue', () => {
  beforeAll(async () => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('paginates profiles and fans out deduplicated jobs', async () => {
    mocks.consumerProfileFindMany.mockResolvedValue([{ id: 'cop_1' }, { id: 'cop_2' }]);
    let processor = mocks.queueProcessors.get('cons/profileOrgActor/rec/search')!;

    await processor({ cursor: 'cop_0' });

    expect(mocks.consumerProfileFindMany).toHaveBeenCalledWith({
      where: { id: { gt: 'cop_0' } },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true }
    });
    expect(mocks.queueAddMany.get('cons/profileOrgActor/rec/single')).toHaveBeenCalledWith([
      {
        data: { consumerProfileId: 'cop_1' },
        opts: { id: 'cop_1' }
      },
      {
        data: { consumerProfileId: 'cop_2' },
        opts: { id: 'cop_2' }
      }
    ]);
    expect(mocks.queueAdds.get('cons/profileOrgActor/rec/search')).toHaveBeenCalledWith({
      cursor: 'cop_2'
    });
  });

  it('stops pagination when no profiles remain', async () => {
    mocks.consumerProfileFindMany.mockResolvedValue([]);
    let processor = mocks.queueProcessors.get('cons/profileOrgActor/rec/search')!;

    await processor({ cursor: 'cop_2' });

    expect(mocks.queueAddMany.get('cons/profileOrgActor/rec/single')).not.toHaveBeenCalled();
    expect(mocks.queueAdds.get('cons/profileOrgActor/rec/search')).not.toHaveBeenCalled();
  });

  it('reloads and reconciles each profile', async () => {
    let consumerProfile = { id: 'cop_1', oid: 1n };
    mocks.consumerProfileFindUnique.mockResolvedValue(consumerProfile);
    let processor = mocks.queueProcessors.get('cons/profileOrgActor/rec/single')!;

    await processor({ consumerProfileId: 'cop_1' });

    expect(mocks.reconcileProfile).toHaveBeenCalledWith({ consumerProfile });
  });
});
