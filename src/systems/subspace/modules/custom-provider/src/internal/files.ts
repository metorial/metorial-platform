import {
  type CustomProvider,
  type CustomProviderDeployment,
  type CustomProviderFrom,
  type CustomProviderVersion,
  db,
  type Environment,
  snowflake,
  type Solution,
  type Tenant,
  type TenantActor
} from '@metorial-subspace/db';
import { getTenantForOrigin, origin } from '../origin';
import { linkRepo } from './linkRepo';

let getImmutableBucketForRepoVersion = async (d: {
  provider: CustomProvider;
  deployment: CustomProviderDeployment;
  version: CustomProviderVersion;
  from: CustomProviderFrom;

  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  actor: TenantActor;
}) => {
  let provider = await db.customProvider.findUniqueOrThrow({
    where: { oid: d.version.customProviderOid },
    include: { scmRepo: true, draftCodeBucket: true }
  });
  let deployment = d.deployment;
  if (d.from.type !== 'function' || !d.from.repository) {
    throw new Error('Can only get files for function providers');
  }

  // Patch any issues with the provider not being linked to the correct repo
  if (
    !provider?.scmRepo ||
    !provider.draftCodeBucket ||
    ('repositoryId' in d.from.repository
      ? provider.scmRepo.id !== d.from.repository.repositoryId
      : provider.scmRepo.fromRepoUrl !== d.from.repository.repositoryUrl)
  ) {
    let linkedRepo = await linkRepo({
      tenant: d.tenant,
      solution: d.solution,
      actor: d.actor,
      repo: d.from.repository
    });

    provider = await db.customProvider.update({
      where: { oid: d.version.customProviderOid },
      data: {
        scmRepoOid: linkedRepo.repo.oid,
        draftCodeBucketOid: linkedRepo.syncedCodeBucket.oid
      },
      include: { scmRepo: true, draftCodeBucket: true }
    });
  }

  if (!provider.draftCodeBucket || !provider.scmRepo) {
    throw new Error('Cannot create function deployment without linked SCM repository');
  }

  let originTenant = await getTenantForOrigin(d.tenant);

  // If the deployment isn't associated with a repo push, trigger one now
  if (!deployment.scmRepoPushOid) {
    let env = deployment.sourceEnvironmentOid
      ? await db.customProviderEnvironment.findUniqueOrThrow({
          where: { oid: deployment.sourceEnvironmentOid }
        })
      : null;

    let originPushRes = await origin.scmRepository.triggerPush({
      tenantId: originTenant.id,
      scmRepositoryId: provider.scmRepo.id,
      branchName: env?.branchName ?? undefined
    });

    if (originPushRes.success && originPushRes.push) {
      let originPush = originPushRes.push;
      let pushRecord = await db.scmRepoPush.create({
        data: {
          oid: snowflake.nextId(),
          id: originPush.id,

          pusherName: originPush.pusherName,
          pusherEmail: originPush.pusherEmail,
          senderIdentifier: originPush.senderIdentifier,
          commitMessage: originPush.commitMessage,

          branchName: originPush.branchName,
          sha: originPush.sha,

          repoOid: provider.scmRepo.oid,
          tenantOid: provider.tenantOid,
          solutionOid: provider.solutionOid
        }
      });

      deployment = await db.customProviderDeployment.update({
        where: { oid: deployment.oid },
        data: { scmRepoPushOid: pushRecord.oid }
      });
    }
  }

  let immutableBucketOriginId: string;
  if (deployment.scmRepoPushOid) {
    let push = await db.scmRepoPush.findUniqueOrThrow({
      where: { oid: deployment.scmRepoPushOid },
      include: { repo: true }
    });

    let immutableBucketOrigin = await origin.codeBucket.createFromRepo({
      tenantId: originTenant.id,
      scmRepoId: push.repo.id,
      purpose: 'subspace.custom_provider_files',
      path: provider.draftCodeBucket.scmRepoPath ?? '/',
      ref: push.sha,
      isReadOnly: true,
      isSynced: false
    });
    immutableBucketOriginId = immutableBucketOrigin.id;
  } else {
    let immutableBucketOrigin = await origin.codeBucket.clone({
      tenantId: originTenant.id,
      codeBucketId: provider.draftCodeBucket.id
    });
    immutableBucketOriginId = immutableBucketOrigin.id;
  }

  let immutableBucket = await db.codeBucket.create({
    data: {
      oid: snowflake.nextId(),
      id: immutableBucketOriginId,

      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,

      isSynced: false,
      isReadOnly: true,
      isImmutable: true
    }
  });

  await db.customProviderVersion.updateMany({
    where: { oid: d.version.oid },
    data: {
      immutableCodeBucketOid: immutableBucket.oid,
      scmRepoOid: provider.scmRepoOid
    }
  });

  await db.customProviderDeployment.updateMany({
    where: { oid: d.version.deploymentOid },
    data: {
      immutableCodeBucketOid: immutableBucket.oid,
      scmRepoOid: provider.scmRepoOid
    }
  });

  return {
    originTenant,
    immutableBucket
  };
};

let getImmutableBucketForFiles = async (d: {
  provider: CustomProvider;
  deployment: CustomProviderDeployment;
  version: CustomProviderVersion;
  from: CustomProviderFrom;

  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  actor: TenantActor;
}) => {
  let provider = await db.customProvider.findUniqueOrThrow({
    where: { oid: d.version.customProviderOid },
    include: { draftCodeBucket: true }
  });
  if (d.from.type !== 'function' || !d.from.files) {
    throw new Error('Can only get files for function providers');
  }

  let originTenant = await getTenantForOrigin(d.tenant);

  // If we don't have a draft bucket, or the custom provider
  // used to be linked to a repo but now switched to files,
  // create a new draft bucket
  if (!provider.draftCodeBucket || provider.scmRepoOid) {
    let originDraftBucket = await origin.codeBucket.create({
      tenantId: originTenant.id,
      purpose: 'subspace.custom_provider_draft'
    });

    let draftBucket = await db.codeBucket.create({
      data: {
        oid: snowflake.nextId(),
        id: originDraftBucket.id,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,

        isSynced: false,
        isReadOnly: false,
        isImmutable: false
      }
    });

    provider = await db.customProvider.update({
      where: { oid: d.version.customProviderOid },
      data: {
        draftCodeBucketOid: draftBucket.oid,
        scmRepoOid: null
      },
      include: { draftCodeBucket: true }
    });
  }

  if (d.from.files.length) {
    await origin.codeBucket.setFiles({
      tenantId: originTenant.id,
      codeBucketId: provider.draftCodeBucket!.id,
      files: d.from.files.map(f => ({
        path: f.filename,
        data: f.content,
        encoding: f.encoding ?? 'utf-8'
      }))
    });
  }

  let immutableBucketOrigin = d.from.files.length
    ? await origin.codeBucket.create({
        tenantId: originTenant.id,
        purpose: 'subspace.custom_provider_files',
        isReadOnly: true,
        files: d.from.files.map(f => ({
          path: f.filename,
          data: f.content,
          encoding: f.encoding ?? 'utf-8'
        }))
      })
    : await origin.codeBucket.clone({
        tenantId: originTenant.id,
        codeBucketId: provider.draftCodeBucket!.id
      });

  let immutableBucket = await db.codeBucket.create({
    data: {
      oid: snowflake.nextId(),
      id: immutableBucketOrigin.id,

      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,

      isSynced: false,
      isReadOnly: true,
      isImmutable: true
    }
  });

  await db.customProviderVersion.updateMany({
    where: { oid: d.version.oid },
    data: {
      immutableCodeBucketOid: immutableBucket.oid,
      scmRepoOid: null
    }
  });

  await db.customProviderDeployment.updateMany({
    where: { oid: d.version.deploymentOid },
    data: {
      immutableCodeBucketOid: immutableBucket.oid,
      scmRepoOid: null,
      scmRepoPushOid: null
    }
  });

  return {
    originTenant,
    immutableBucket
  };
};

export let getImmutableBucketForCustomProviderVersion = async (d: {
  provider: CustomProvider;
  deployment: CustomProviderDeployment;
  version: CustomProviderVersion;
  from: CustomProviderFrom;

  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  actor: TenantActor;
}) => {
  if (d.from.type === 'function') {
    if (d.from.repository) {
      return await getImmutableBucketForRepoVersion(d);
    }

    if (d.from.files) {
      return await getImmutableBucketForFiles(d);
    }
  }

  throw new Error('Unsupported from type for getting immutable bucket');
};
