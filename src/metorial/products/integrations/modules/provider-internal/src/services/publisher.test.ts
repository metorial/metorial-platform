import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let brandFindFirst = vi.fn();
  let publisherFindFirst = vi.fn();
  let publisherUpsert = vi.fn();

  return {
    brandFindFirst,
    publisherFindFirst,
    publisherUpsert,
    createTag: vi.fn(),
    db: {
      brand: {
        findFirst: brandFindFirst
      },
      publisher: {
        findFirst: publisherFindFirst,
        upsert: publisherUpsert
      }
    }
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/canonicalize', () => ({
  canonicalize: (value: unknown) => JSON.stringify(value ?? null)
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: (model: string) => ({ oid: 100n, id: `${model}_id` }),
  withTransaction: async (fn: (tx: typeof mocks.db) => Promise<unknown>) => await fn(mocks.db),
  addAfterTransactionHook: async (fn: () => Promise<unknown>) => await fn()
}));

vi.mock('../lib/createTag', () => ({
  createTag: mocks.createTag
}));

vi.mock('../queues/lifecycle/publisher', () => ({
  publisherCreatedQueue: { add: vi.fn() },
  publisherUpdatedQueue: { add: vi.fn() }
}));

import { publisherInternalService } from './publisher';

let makeTenant = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 3n,
    id: 'ktn_1',
    name: 'Acme',
    projectOid: 7n,
    ...overrides
  }) as any;

describe('publisherInternalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.brandFindFirst.mockResolvedValue(null);
    mocks.publisherFindFirst.mockResolvedValue(null);
    mocks.createTag.mockResolvedValue('tag_1');
    mocks.publisherUpsert.mockImplementation(async ({ create }: any) => ({ ...create }));
  });

  it('mirrors the project reference when creating a publisher for a tenant', async () => {
    await publisherInternalService.upsertPublisherForTenant({
      tenant: makeTenant()
    });

    expect(mocks.publisherUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 3n,
          projectOid: 7n
        })
      })
    );
  });

  it('writes a null project reference for a tenant that is not linked to a project', async () => {
    await publisherInternalService.upsertPublisherForTenant({
      tenant: makeTenant({ projectOid: null })
    });

    let { create } = mocks.publisherUpsert.mock.calls[0]![0];
    expect(create.tenantOid).toBe(3n);
    expect(create.projectOid).toBeNull();
  });

  it('keeps the project reference null for a global publisher', async () => {
    await publisherInternalService.upsertPublisherForMetorial();

    let { create } = mocks.publisherUpsert.mock.calls[0]![0];
    expect(create.tenantOid).toBeNull();
    expect(create.projectOid).toBeNull();
  });
});
