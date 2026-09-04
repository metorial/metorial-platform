import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    codeBucket: { findFirst: vi.fn(), create: vi.fn() },
    scmRepo: { upsert: vi.fn() }
  },
  origin: {
    actor: { upsert: vi.fn() },
    scmRepository: { get: vi.fn(), searchAndLinkRepo: vi.fn() },
    codeBucket: { createFromRepo: vi.fn() }
  },
  getTenantForOrigin: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  snowflake: { nextId: () => 1n }
}));

vi.mock('../origin', () => ({
  origin: mocks.origin,
  getTenantForOrigin: mocks.getTenantForOrigin
}));

import { ensureScmRepoForOrigin, linkRepo } from './linkRepo';

let linkedTenant = { oid: 20n, projectOid: 21n, identifier: 'tnt', name: 'Tenant' };
let solution = { oid: 1 };
let actor = { oid: 40n, name: 'System', identifier: 'system' };

let originRepo = {
  id: 'kscr_1',
  identifier: 'repo',
  provider: 'github',
  name: 'repo',
  externalId: 'e1',
  externalName: 'repo',
  externalOwner: 'owner',
  externalUrl: 'https://example.test/owner/repo',
  externalIsPrivate: false,
  defaultBranch: 'main'
};

let callLinkRepo = (tenant: Record<string, unknown> = linkedTenant) =>
  linkRepo({
    tenant,
    solution,
    actor,
    repo: { repositoryId: 'kscr_1', branch: 'main' }
  } as any);

describe('linkRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantForOrigin.mockResolvedValue({ id: 'otn_1', identifier: 'tnt' });
    mocks.origin.actor.upsert.mockResolvedValue({ id: 'oac_1' });
    mocks.origin.scmRepository.get.mockResolvedValue(originRepo);
    mocks.origin.codeBucket.createFromRepo.mockResolvedValue({ id: 'kcb_1' });
    mocks.db.scmRepo.upsert.mockResolvedValue({ oid: 50n, id: 'kscr_1' });
    mocks.db.codeBucket.findFirst.mockResolvedValue(null);
    mocks.db.codeBucket.create.mockResolvedValue({ oid: 60n });
  });

  it('mirrors the tenant project onto a newly created synced code bucket', async () => {
    await callLinkRepo();

    expect(mocks.db.codeBucket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: 21n })
    });
  });

  // The create payload is spread from the same object used to look the bucket up, so the
  // mirrored column must not leak into the lookup.
  it('does not add the mirrored column to the code bucket lookup filter', async () => {
    await callLinkRepo();

    let [findCall] = mocks.db.codeBucket.findFirst.mock.calls;
    expect(findCall![0].where).toEqual({
      scmRepoOid: 50n,
      scmRepoPath: '/',
      isImmutable: false,
      isReadOnly: true,
      isSynced: true,
      tenantOid: 20n,
      solutionOid: 1
    });
    expect(findCall![0].where).not.toHaveProperty('projectOid');
  });

  it('writes null for a tenant that is not linked to a project yet', async () => {
    await callLinkRepo({ ...linkedTenant, projectOid: null });

    expect(mocks.db.codeBucket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantOid: 20n, projectOid: null })
    });
  });

  it('does not create a code bucket when a matching one already exists', async () => {
    mocks.db.codeBucket.findFirst.mockResolvedValue({ oid: 61n });

    await callLinkRepo();

    expect(mocks.db.codeBucket.create).not.toHaveBeenCalled();
  });
});

describe('ensureScmRepoForOrigin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.scmRepo.upsert.mockResolvedValue({ oid: 50n });
  });

  it('mirrors the project on create but leaves the update payload untouched', async () => {
    await ensureScmRepoForOrigin({
      originRepo,
      tenant: linkedTenant,
      solution
    } as any);

    let [call] = mocks.db.scmRepo.upsert.mock.calls;
    expect(call![0].create).toEqual(
      expect.objectContaining({ tenantOid: 20n, projectOid: 21n })
    );
    expect(call![0].update).not.toHaveProperty('projectOid');
    expect(call![0].update).not.toHaveProperty('tenantOid');
  });
});
