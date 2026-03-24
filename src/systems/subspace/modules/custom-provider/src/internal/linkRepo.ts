import { db, snowflake, type Solution, type Tenant, TenantActor } from '@metorial-subspace/db';
import { getTenantForOrigin, origin } from '../origin';

export let linkRepo = async (d: {
  tenant: Tenant;
  solution: Solution;
  actor: TenantActor;
  repo:
    | {
        repositoryId: string;
        branch: string;
        path?: string;
      }
    | {
        type?: 'git';
        repositoryUrl: string;
        branch: string;
        path?: string;
      };
}) => {
  let originTenant = await getTenantForOrigin(d.tenant);
  let originActor = await origin.actor.upsert({
    name: d.actor.name,
    identifier: d.actor.identifier
  });

  let originRepo =
    'repositoryId' in d.repo
      ? await origin.scmRepository.get({
          tenantId: originTenant.id,
          scmRepositoryId: d.repo.repositoryId
        })
      : await origin.scmRepository.searchAndLinkRepo({
          tenantId: originTenant.id,
          actorId: originActor.id,
          repositoryUrl: d.repo.repositoryUrl
        });

  let repo = await ensureScmRepoForOrigin({
    originRepo,
    tenant: d.tenant,
    solution: d.solution
  });

  let codeBucketFilter = {
    scmRepoOid: repo.oid,
    scmRepoPath: d.repo.path ?? '/',
    isImmutable: false,
    isReadOnly: true,
    isSynced: true,
    tenantOid: d.tenant.oid,
    solutionOid: d.solution.oid
  };
  let syncedCodeBucket = await db.codeBucket.findFirst({
    where: codeBucketFilter
  });

  if (!syncedCodeBucket) {
    let bucket = await origin.codeBucket.createFromRepo({
      tenantId: originTenant.id,
      scmRepoId: originRepo.id,
      purpose: 'subspace.custom_provider_files',
      path: d.repo.path ?? '/',
      isReadOnly: true,
      isSynced: true
    });

    syncedCodeBucket = await db.codeBucket.create({
      data: {
        oid: snowflake.nextId(),
        id: bucket.id,
        ...codeBucketFilter
      }
    });
  }

  return {
    repo,
    syncedCodeBucket
  };
};

export let ensureScmRepoForOrigin = async (d: {
  originRepo: Awaited<ReturnType<typeof origin.scmRepository.get>>;
  tenant: Tenant;
  solution: Solution;
  fromRepoUrl?: string;
}) => {
  let inner = {
    identifier: d.originRepo.identifier,
    provider: d.originRepo.provider,
    fromRepoUrl: d.fromRepoUrl,
    name: d.originRepo.name,

    externalId: d.originRepo.externalId,
    externalName: d.originRepo.externalName,
    externalOwner: d.originRepo.externalOwner,
    externalUrl: d.originRepo.externalUrl,
    externalIsPrivate: d.originRepo.externalIsPrivate,

    defaultBranch: d.originRepo.defaultBranch
  };

  return await db.scmRepo.upsert({
    where: { id: d.originRepo.id },
    create: {
      oid: snowflake.nextId(),
      id: d.originRepo.id,
      ...inner,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid
    },
    update: inner
  });
};
