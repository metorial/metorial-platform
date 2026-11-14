import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    skillRepository: { findMany: vi.fn(), update: vi.fn() }
  }
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (tx: typeof db) => unknown) => await run(db)
}));

import {
  ensureSkillRepositoryOwnsProviderRepository,
  getProviderIdentityUpdate,
  getProviderRepositoryIdentity,
  providerIdentityRefreshIntervalMs,
  resolveProviderRepositoryConflict
} from './repositoryIdentity';

let githubRepository = {
  provider: 'github' as const,
  identifier: 'github.com/aeye-emu/metorial-skills',
  externalId: '123456'
};

describe('getProviderRepositoryIdentity', () => {
  it('builds a key from the provider id and a path from the identifier', () => {
    expect(getProviderRepositoryIdentity(githubRepository)).toEqual({
      key: 'github:github.com:123456',
      path: 'github:github.com/aeye-emu/metorial-skills'
    });
  });

  it('lowercases the host and path and trims slashes and whitespace', () => {
    expect(
      getProviderRepositoryIdentity({
        provider: 'gitlab',
        identifier: ' /GitLab.Example.com/Group/Sub/Proj/ ',
        externalId: ' 42 '
      })
    ).toEqual({
      key: 'gitlab:gitlab.example.com:42',
      path: 'gitlab:gitlab.example.com/group/sub/proj'
    });
  });

  it('gives a recreated repository with the same name a new key but the same path', () => {
    let original = getProviderRepositoryIdentity(githubRepository);
    let recreated = getProviderRepositoryIdentity({ ...githubRepository, externalId: '999' });

    expect(recreated.key).not.toBe(original.key);
    expect(recreated.path).toBe(original.path);
  });

  it('keeps the same repository on different providers or hosts apart', () => {
    let github = getProviderRepositoryIdentity(githubRepository);
    let enterprise = getProviderRepositoryIdentity({
      ...githubRepository,
      identifier: 'github.acme.com/aeye-emu/metorial-skills'
    });
    let bitbucket = getProviderRepositoryIdentity({
      ...githubRepository,
      provider: 'bitbucket'
    });

    expect(new Set([github.key, enterprise.key, bitbucket.key]).size).toBe(3);
    expect(new Set([github.path, enterprise.path, bitbucket.path]).size).toBe(3);
  });
});

describe('getProviderIdentityUpdate', () => {
  let identity = getProviderRepositoryIdentity(githubRepository);
  let now = new Date('2026-11-12T12:00:00Z');

  it('skips the write while the stored identity is current and fresh', () => {
    expect(
      getProviderIdentityUpdate({
        skillRepository: {
          oid: 1n,
          providerRepositoryKey: identity.key,
          providerRepositoryPath: identity.path,
          providerIdentityRefreshedAt: new Date(now.getTime() - 60_000)
        },
        identity,
        now
      })
    ).toBeNull();
  });

  it.each([
    ['missing', { providerRepositoryKey: null, providerRepositoryPath: null, ago: 60_000 }],
    [
      'renamed',
      {
        providerRepositoryKey: identity.key,
        providerRepositoryPath: 'github:github.com/old/name',
        ago: 60_000
      }
    ],
    [
      'stale',
      {
        providerRepositoryKey: identity.key,
        providerRepositoryPath: identity.path,
        ago: providerIdentityRefreshIntervalMs + 1
      }
    ]
  ])('rewrites an identity that is %s', (_, stored) => {
    expect(
      getProviderIdentityUpdate({
        skillRepository: {
          oid: 1n,
          providerRepositoryKey: stored.providerRepositoryKey,
          providerRepositoryPath: stored.providerRepositoryPath,
          providerIdentityRefreshedAt: new Date(now.getTime() - stored.ago)
        },
        identity,
        now
      })
    ).toEqual({
      providerRepositoryKey: identity.key,
      providerRepositoryPath: identity.path,
      providerIdentityRefreshedAt: now
    });
  });
});

describe('resolveProviderRepositoryConflict', () => {
  let claim = (oid: bigint, linkedAt: string) => ({
    id: `srep_${oid}`,
    oid,
    linkedAt: new Date(linkedAt)
  });

  it('has no conflict when nothing else claims the repository', () => {
    expect(
      resolveProviderRepositoryConflict({ skillRepositoryOid: 1n, claims: [] })
    ).toBeNull();
    expect(
      resolveProviderRepositoryConflict({
        skillRepositoryOid: 1n,
        claims: [claim(1n, '2026-01-01')]
      })
    ).toBeNull();
  });

  it('rejects a repository that is not linked yet when another link exists', () => {
    expect(
      resolveProviderRepositoryConflict({
        skillRepositoryOid: 1n,
        claims: [claim(5n, '2026-03-01')]
      })
    ).toMatchObject({ oid: 5n });
  });

  it('lets the earliest link keep the repository and fails every later one', () => {
    let claims = [claim(3n, '2026-02-01'), claim(7n, '2026-01-01'), claim(9n, '2026-03-01')];

    expect(resolveProviderRepositoryConflict({ skillRepositoryOid: 7n, claims })).toBeNull();
    expect(
      resolveProviderRepositoryConflict({ skillRepositoryOid: 3n, claims })
    ).toMatchObject({
      oid: 7n
    });
    expect(
      resolveProviderRepositoryConflict({ skillRepositoryOid: 9n, claims })
    ).toMatchObject({
      oid: 7n
    });
  });

  it('breaks ties between links made at the same time by the older row', () => {
    let claims = [claim(4n, '2026-01-01'), claim(2n, '2026-01-01')];

    expect(resolveProviderRepositoryConflict({ skillRepositoryOid: 2n, claims })).toBeNull();
    expect(
      resolveProviderRepositoryConflict({ skillRepositoryOid: 4n, claims })
    ).toMatchObject({
      oid: 2n
    });
  });
});

describe('ensureSkillRepositoryOwnsProviderRepository', () => {
  let identity = getProviderRepositoryIdentity(githubRepository);
  let skillRepository = {
    oid: 2n,
    providerRepositoryKey: null,
    providerRepositoryPath: null,
    providerIdentityRefreshedAt: null
  };

  beforeEach(() => vi.clearAllMocks());

  it('stores a missing identity and searches active links by key or path', async () => {
    db.skillRepository.findMany.mockResolvedValue([
      {
        id: 'srep_2',
        oid: 2n,
        marketplaceRepository: { createdAt: new Date('2026-01-01') },
        pluginRepository: null
      }
    ]);

    expect(
      await ensureSkillRepositoryOwnsProviderRepository({
        skillRepository,
        originRepository: githubRepository
      })
    ).toEqual({ ok: true });

    expect(db.skillRepository.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: {
        providerRepositoryKey: identity.key,
        providerRepositoryPath: identity.path,
        providerIdentityRefreshedAt: expect.any(Date)
      }
    });
    expect(db.skillRepository.findMany.mock.calls[0]![0].where.AND[1]).toEqual({
      OR: [{ providerRepositoryKey: identity.key }, { providerRepositoryPath: identity.path }]
    });
  });

  it('reports the earlier link as the owner', async () => {
    db.skillRepository.findMany.mockResolvedValue([
      {
        id: 'srep_2',
        oid: 2n,
        marketplaceRepository: { createdAt: new Date('2026-02-01') },
        pluginRepository: null
      },
      {
        id: 'srep_8',
        oid: 8n,
        marketplaceRepository: null,
        pluginRepository: { createdAt: new Date('2026-01-01') }
      }
    ]);

    expect(
      await ensureSkillRepositoryOwnsProviderRepository({
        skillRepository,
        originRepository: githubRepository
      })
    ).toEqual({
      ok: false,
      owner: { id: 'srep_8', oid: 8n, linkedAt: new Date('2026-01-01') }
    });
  });
});
