import type { Prisma, SkillRepository } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import type { OriginRepositoryRecord } from '../services/skillRepository';

export let providerIdentityRefreshIntervalMs = 24 * 60 * 60 * 1000;

export let repositoryLinkedElsewhereErrorCode = 'repository_linked_elsewhere';
export let repositoryLinkedElsewhereMessage =
  'This repository is already connected to another skill marketplace or plugin. Disconnect it there first, or choose a different repository.';

export type ProviderRepositoryIdentity = { key: string; path: string };

type StoredProviderIdentity = Pick<
  SkillRepository,
  'oid' | 'providerRepositoryKey' | 'providerRepositoryPath' | 'providerIdentityRefreshedAt'
>;

export type ProviderRepositoryClaim = { id: string; oid: bigint; linkedAt: Date };

// Link rows are hard-deleted on unlink and when a marketplace or plugin is archived; the status
// checks cover rows that stay behind when a parent is deactivated another way.
export let activeSkillRepositoryLinkWhere = {
  project: { status: 'active' },
  instance: { status: 'active' },
  OR: [
    { marketplaceRepository: { skillMarketplace: { status: 'active' } } },
    { pluginRepository: { skillPlugin: { status: 'active' } } }
  ]
} satisfies Prisma.SkillRepositoryWhereInput;

let normalizePath = (value: string) =>
  value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

export let getProviderRepositoryIdentity = (
  originRepository: Pick<OriginRepositoryRecord, 'provider' | 'identifier' | 'externalId'>
): ProviderRepositoryIdentity => {
  let provider = originRepository.provider.trim().toLowerCase();
  let path = normalizePath(originRepository.identifier);
  let host = path.split('/')[0];

  return {
    key: `${provider}:${host}:${originRepository.externalId.trim()}`,
    path: `${provider}:${path}`
  };
};

export let getProviderIdentityUpdate = (d: {
  skillRepository: StoredProviderIdentity;
  identity: ProviderRepositoryIdentity;
  now: Date;
}) => {
  let refreshedAt = d.skillRepository.providerIdentityRefreshedAt;
  let isCurrent =
    d.skillRepository.providerRepositoryKey === d.identity.key &&
    d.skillRepository.providerRepositoryPath === d.identity.path &&
    !!refreshedAt &&
    d.now.getTime() - refreshedAt.getTime() < providerIdentityRefreshIntervalMs;
  if (isCurrent) return null;

  return {
    providerRepositoryKey: d.identity.key,
    providerRepositoryPath: d.identity.path,
    providerIdentityRefreshedAt: d.now
  };
};

// The earliest active link owns the provider repository; ties fall back to the older row.
export let resolveProviderRepositoryConflict = <T extends ProviderRepositoryClaim>(d: {
  skillRepositoryOid: bigint;
  claims: T[];
}): T | null => {
  if (!d.claims.some(claim => claim.oid !== d.skillRepositoryOid)) return null;

  let [owner] = [...d.claims].sort(
    (a, b) =>
      a.linkedAt.getTime() - b.linkedAt.getTime() ||
      (a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0)
  );

  return owner!.oid === d.skillRepositoryOid ? null : owner!;
};

export let findConflictingSkillRepository = async (d: {
  skillRepositoryOid: bigint;
  identity: { key: string | null; path: string | null };
}) => {
  let identityFilters = [
    ...(d.identity.key ? [{ providerRepositoryKey: d.identity.key }] : []),
    ...(d.identity.path ? [{ providerRepositoryPath: d.identity.path }] : [])
  ];
  if (!identityFilters.length) return null;

  let claims = await withTransaction(
    async db =>
      await db.skillRepository.findMany({
        where: { AND: [activeSkillRepositoryLinkWhere, { OR: identityFilters }] },
        select: {
          id: true,
          oid: true,
          marketplaceRepository: { select: { createdAt: true } },
          pluginRepository: { select: { createdAt: true } }
        }
      }),
    { ifExists: true }
  );

  return resolveProviderRepositoryConflict({
    skillRepositoryOid: d.skillRepositoryOid,
    claims: claims.map(claim => ({
      id: claim.id,
      oid: claim.oid,
      linkedAt: new Date(
        Math.min(
          ...[claim.marketplaceRepository?.createdAt, claim.pluginRepository?.createdAt].map(
            date => date?.getTime() ?? Infinity
          )
        )
      )
    }))
  });
};

export let refreshSkillRepositoryProviderIdentity = async (d: {
  skillRepository: StoredProviderIdentity;
  originRepository: Pick<OriginRepositoryRecord, 'provider' | 'identifier' | 'externalId'>;
}) => {
  let identity = getProviderRepositoryIdentity(d.originRepository);
  let update = getProviderIdentityUpdate({
    skillRepository: d.skillRepository,
    identity,
    now: new Date()
  });

  if (update) {
    await withTransaction(
      async db =>
        await db.skillRepository.update({
          where: { oid: d.skillRepository.oid },
          data: update
        }),
      { ifExists: true }
    );
  }

  return identity;
};

export let ensureSkillRepositoryOwnsProviderRepository = async (d: {
  skillRepository: StoredProviderIdentity;
  originRepository: Pick<OriginRepositoryRecord, 'provider' | 'identifier' | 'externalId'>;
}): Promise<{ ok: true } | { ok: false; owner: ProviderRepositoryClaim }> => {
  let identity = await refreshSkillRepositoryProviderIdentity(d);

  let owner = await findConflictingSkillRepository({
    skillRepositoryOid: d.skillRepository.oid,
    identity
  });

  return owner ? { ok: false, owner } : { ok: true };
};
