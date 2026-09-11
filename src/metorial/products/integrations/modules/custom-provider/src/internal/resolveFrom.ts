import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  CustomProvider,
  CustomProviderConfig,
  CustomProviderFrom,
  CustomProviderFromFunction,
  CustomProviderFromUpdate,
  ScmRepo
} from '@metorial-subspace/db';

export let mergeCustomProviderFromUpdate = (
  base: CustomProviderFrom,
  update?: CustomProviderFromUpdate
): CustomProviderFrom => {
  if (!update) return base;

  if (base.type !== update.type) {
    throw new ServiceError(
      badRequestError({
        message: `Cannot change custom provider type from '${base.type}' to '${update.type}'`,
        hint: 'The deployment from type must match the custom provider type.'
      })
    );
  }

  if (base.type === 'function' && update.type === 'function') {
    return {
      type: 'function',
      env: update.env ?? base.env,
      runtime: update.runtime ?? base.runtime,
      repository: update.repository !== undefined ? update.repository : base.repository,
      files: update.files !== undefined ? update.files : base.files
    };
  }

  if (base.type === 'container' && update.type === 'container') {
    return {
      type: 'container',
      repository: {
        ...base.repository,
        ...update.repository
      }
    };
  }

  if (base.type === 'remote' && update.type === 'remote') {
    return {
      type: 'remote',
      remoteUrl: update.remoteUrl ?? base.remoteUrl,
      protocol: update.protocol ?? base.protocol,
      oauthConfig: update.oauthConfig !== undefined ? update.oauthConfig : base.oauthConfig
    };
  }

  return base;
};

export let synthesizeRepositoryFromScmRepo = (
  scmRepo: ScmRepo
): CustomProviderFromFunction['repository'] => {
  if (scmRepo.fromRepoUrl) {
    return {
      type: 'git',
      repositoryUrl: scmRepo.fromRepoUrl,
      branch: scmRepo.defaultBranch
    };
  }

  return {
    repositoryId: scmRepo.id,
    branch: scmRepo.defaultBranch
  };
};

let assertFunctionDeployable = (
  from: CustomProviderFromFunction,
  provider: CustomProvider
) => {
  let hasFiles = from.files !== undefined;
  let hasRepository = !!from.repository;
  let hasScmRepo = !!provider.scmRepoOid;
  let hasDraftBucket = !!provider.draftCodeBucketOid;

  if (!hasFiles && !hasRepository && !hasScmRepo && !hasDraftBucket) {
    throw new ServiceError(
      badRequestError({
        message:
          'No deployment source provided. Either files, an SCM repository, or an existing linked source must be available to create a deployment.',
        hint: 'Please provide deployment files, link an SCM repository, or ensure the custom provider has a linked repo or draft code bucket.'
      })
    );
  }

  if (!from.env || !from.runtime) {
    throw new ServiceError(
      badRequestError({
        message: 'Function deployment requires env and runtime.',
        hint: 'Provide env and runtime in the request or ensure they are set on the custom provider.'
      })
    );
  }
};

export let resolveCustomProviderFromForDeployment = (d: {
  partial?: CustomProviderFromUpdate;
  provider: CustomProvider & { scmRepo?: ScmRepo | null };
}): CustomProviderFrom => {
  let merged = mergeCustomProviderFromUpdate(d.provider.payload.from, d.partial);

  if (merged.type === 'function') {
    if (!merged.repository && !merged.files?.length && d.provider.scmRepoOid && d.provider.scmRepo) {
      merged = {
        ...merged,
        repository: synthesizeRepositoryFromScmRepo(d.provider.scmRepo)
      };
    }

    if (
      !merged.repository &&
      merged.files === undefined &&
      d.provider.draftCodeBucketOid &&
      !d.provider.scmRepoOid
    ) {
      merged = {
        ...merged,
        files: []
      };
    }

    assertFunctionDeployable(merged, d.provider);
    return merged;
  }

  if (merged.type === 'container') {
    if (!merged.repository?.imageRef) {
      throw new ServiceError(
        badRequestError({
          message: 'Container deployment requires an image reference.',
          hint: 'Provide repository.imageRef in the request or ensure it is set on the custom provider.'
        })
      );
    }
    return merged;
  }

  if (merged.type === 'remote') {
    if (!merged.remoteUrl || !merged.protocol) {
      throw new ServiceError(
        badRequestError({
          message: 'Remote deployment requires remoteUrl and protocol.',
          hint: 'Provide remoteUrl and protocol in the request or ensure they are set on the custom provider.'
        })
      );
    }
    return merged;
  }

  return merged;
};

export let resolveCustomProviderConfig = (
  partial?: CustomProviderConfig,
  base?: CustomProviderConfig
): CustomProviderConfig | undefined => {
  return partial ?? base;
};
