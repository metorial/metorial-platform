import type {
  CodeBucket,
  CustomProvider,
  CustomProviderCommit,
  CustomProviderDeployment,
  CustomProviderVersion,
  Provider,
  ScmRepo,
  ScmRepoPush,
  TenantActor
} from '@metorial-subspace/db';
import { actorPresenter } from './actor';
import { bucketPresenter } from './bucket';
import { scmPushPresenter } from './scmPush';

export let customProviderDeploymentPresenter = (
  customProviderDeployment: CustomProviderDeployment & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    customProviderVersion: CustomProviderVersion | null;
    commit: CustomProviderCommit | null;

    creatorActor: TenantActor;

    immutableCodeBucket: (CodeBucket & { scmRepo: ScmRepo | null }) | null;

    scmRepoPush: (ScmRepoPush & { repo: ScmRepo }) | null;
  }
) => ({
  object: 'custom_provider.deployment',

  id: customProviderDeployment.id,
  status: customProviderDeployment.status,
  trigger: customProviderDeployment.trigger,

  customProviderId: customProviderDeployment.customProvider.id,
  providerId: customProviderDeployment.customProvider.provider?.id,
  customProviderVersionId: customProviderDeployment.customProviderVersion?.id,

  commit: customProviderDeployment.commit
    ? {
        object: 'custom_provider.deployment.commit',
        id: customProviderDeployment.commit.id,
        type: customProviderDeployment.commit.type,
        status: customProviderDeployment.commit.status,
        trigger: customProviderDeployment.commit.trigger,
        message: customProviderDeployment.commit.message,
        createdAt: customProviderDeployment.commit.createdAt
      }
    : null,

  immutableBucket: customProviderDeployment.immutableCodeBucket
    ? bucketPresenter(customProviderDeployment.immutableCodeBucket)
    : null,

  actor: actorPresenter(customProviderDeployment.creatorActor),

  scmPush: customProviderDeployment.scmRepoPush
    ? scmPushPresenter(customProviderDeployment.scmRepoPush)
    : null,

  createdAt: customProviderDeployment.createdAt,
  updatedAt: customProviderDeployment.updatedAt
});
