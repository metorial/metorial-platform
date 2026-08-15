import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenantActorUpsert: vi.fn(),
  ensureOrganizationActorMirror: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  notFoundError: (resource: string) => ({ resource })
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenantActor: {
      upsert: mocks.tenantActorUpsert,
      findFirst: vi.fn()
    }
  },
  getId: (model: string) => ({ oid: 1n, id: `${model}_1` })
}));

vi.mock('../lib/mirrorRecords', () => ({
  ensureOrganizationActorMirror: mocks.ensureOrganizationActorMirror
}));

import { actorService } from './actor';

let tenant = { oid: 20n, projectOid: 11n } as any;

let input = {
  identifier: 'mte-oac-oac_4',
  name: 'User',
  type: 'external' as const,
  organizationActorId: 'oac_4',
  organizationActorOid: 4n
};

describe('actorService.upsertActor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantActorUpsert.mockResolvedValue({ id: 'act_1' });
  });

  it('creates the organization actor mirror before referencing it', async () => {
    mocks.ensureOrganizationActorMirror.mockResolvedValue(4n);

    await actorService.upsertActor({ tenant, input });

    expect(mocks.ensureOrganizationActorMirror).toHaveBeenCalledWith({
      organizationActorOid: 4n
    });
    expect(mocks.ensureOrganizationActorMirror.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.tenantActorUpsert.mock.invocationCallOrder[0]!
    );
    expect(mocks.tenantActorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ organizationActorOid: 4n, projectOid: 11n }),
        create: expect.objectContaining({ organizationActorOid: 4n, projectOid: 11n })
      })
    );
  });

  it('drops the reference when the organization actor cannot be mirrored', async () => {
    mocks.ensureOrganizationActorMirror.mockResolvedValue(null);

    await actorService.upsertActor({ tenant, input });

    expect(mocks.tenantActorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          organizationActorId: 'oac_4',
          organizationActorOid: undefined
        }),
        create: expect.objectContaining({ organizationActorOid: undefined })
      })
    );
  });

  it('does not look for a mirror when no organization actor is referenced', async () => {
    await actorService.upsertActor({
      tenant,
      input: { identifier: 'system::tnt_20', name: 'System', type: 'system' }
    });

    expect(mocks.ensureOrganizationActorMirror).not.toHaveBeenCalled();
    expect(mocks.tenantActorUpsert).toHaveBeenCalled();
  });
});
