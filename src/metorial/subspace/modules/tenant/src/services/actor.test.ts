import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenantActorUpsert: vi.fn(),
  tenantActorFindFirst: vi.fn(),
  tenantActorUpdate: vi.fn(),
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
      findFirst: mocks.tenantActorFindFirst,
      update: mocks.tenantActorUpdate
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

  it('does not clear an existing project oid when the tenant is not linked yet', async () => {
    await actorService.upsertActor({
      tenant: { oid: 20n, projectOid: null } as any,
      input: { identifier: 'system::tnt_20', name: 'System', type: 'system' }
    });

    let call = mocks.tenantActorUpsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('projectOid');
    expect(call.create.projectOid).toBeNull();
  });

  it('keeps the provided id on create so upsert-by-id can match the existing row', async () => {
    await actorService.upsertActor({
      tenant,
      input: { ...input, id: 'act_existing' }
    });

    expect(mocks.tenantActorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act_existing' },
        create: expect.objectContaining({ id: 'act_existing' })
      })
    );
  });

  it('updates the existing actor after a concurrent unique conflict', async () => {
    let existing = { id: 'act_existing', identifier: input.identifier };
    mocks.ensureOrganizationActorMirror.mockResolvedValue(4n);
    mocks.tenantActorUpsert.mockRejectedValue({ code: 'P2002' });
    mocks.tenantActorFindFirst.mockResolvedValue(existing);
    mocks.tenantActorUpdate.mockResolvedValue({ ...existing, name: input.name });

    await expect(actorService.upsertActor({ tenant, input })).resolves.toEqual({
      ...existing,
      name: input.name
    });

    expect(mocks.tenantActorFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantOid: 20n,
          OR: [{ identifier: input.identifier }, { organizationActorOid: 4n }]
        }
      })
    );
    expect(mocks.tenantActorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'act_existing' },
        data: expect.objectContaining({
          name: input.name,
          identifier: input.identifier,
          organizationActorOid: 4n
        })
      })
    );
  });

  it('returns the existing actor when the follow-up update still conflicts', async () => {
    let existing = { id: 'act_existing', identifier: input.identifier };
    mocks.tenantActorUpsert.mockRejectedValue({ code: 'P2002' });
    mocks.tenantActorFindFirst.mockResolvedValue(existing);
    mocks.tenantActorUpdate.mockRejectedValue({ code: 'P2002' });

    await expect(actorService.upsertActor({ tenant, input })).resolves.toBe(existing);
  });

  it('rethrows unique conflicts when no existing actor can be found', async () => {
    let error = { code: 'P2002' };
    mocks.tenantActorUpsert.mockRejectedValue(error);
    mocks.tenantActorFindFirst.mockResolvedValue(null);

    await expect(actorService.upsertActor({ tenant, input })).rejects.toBe(error);
    expect(mocks.tenantActorUpdate).not.toHaveBeenCalled();
  });
});
