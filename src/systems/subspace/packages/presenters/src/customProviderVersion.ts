import type {
  CodeBucket,
  CustomProvider,
  CustomProviderCommit,
  CustomProviderDeployment,
  CustomProviderEnvironment,
  CustomProviderEnvironmentVersion,
  CustomProviderVersion,
  Environment,
  Provider,
  ProviderEnvironment,
  ProviderVersion,
  ScmRepo,
  ScmRepoPush,
  TenantActor
} from '@metorial-subspace/db';
import type {
  ShuttleContainerRegistry,
  ShuttleContainerRepository,
  ShuttleContainerTag,
  ShuttleContainerVersion
} from '@metorial-subspace/provider-shuttle';
import { actorPresenter } from './actor';
import { bucketPresenter } from './bucket';
import { customProviderDeploymentPresenter } from './customProviderDeployment';
import { customProviderEnvironmentPresenter } from './customProviderEnvironment';

export let customProviderVersionPresenter = (
  customProviderVersion: CustomProviderVersion & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    deployment: CustomProviderDeployment & {
      commit: CustomProviderCommit | null;

      scmRepoPush:
        | (ScmRepoPush & {
            repo: ScmRepo;
          })
        | null;
    };

    immutableCodeBucket: (CodeBucket & { scmRepo: ScmRepo | null }) | null;

    providerVersion: ProviderVersion | null;

    customProviderEnvironmentVersions: (CustomProviderEnvironmentVersion & {
      customProviderEnvironment: CustomProviderEnvironment & {
        environment: Environment;
        providerEnvironment:
          | (ProviderEnvironment & {
              currentVersion: ProviderVersion | null;
            })
          | null;
      };
    })[];

    creatorActor: TenantActor;

    containerTag?: ShuttleContainerTag;
    containerVersion?: ShuttleContainerVersion;
    containerRegistry?: ShuttleContainerRegistry;
    containerRepository?: ShuttleContainerRepository;

    remoteUrl?: string;
    remoteProtocol?: 'sse' | 'streamable_http';
  }
) => {
  let customEnvironments = customProviderVersion.customProviderEnvironmentVersions.map(
    v => v.customProviderEnvironment
  );

  return {
    object: 'custom_provider.version',

    id: customProviderVersion.id,
    status: customProviderVersion.status,

    index: customProviderVersion.versionIndex,
    identifier: customProviderVersion.versionIdentifier,

    deployment: customProviderDeploymentPresenter({
      ...customProviderVersion.deployment,
      customProvider: customProviderVersion.customProvider,
      creatorActor: customProviderVersion.creatorActor,
      customProviderVersion: customProviderVersion,
      immutableCodeBucket: customProviderVersion.immutableCodeBucket
    }),

    environments: customEnvironments.map(cev => ({
      object: 'custom_provider.environment',

      id: cev.id,

      isCurrentVersionForEnvironment:
        customProviderVersion.providerVersion?.oid ===
        cev.providerEnvironment?.currentVersion?.oid,

      environment: customProviderEnvironmentPresenter({
        ...cev,
        customProvider: customProviderVersion.customProvider
      })
    })),

    immutableBucket: customProviderVersion.immutableCodeBucket
      ? bucketPresenter(customProviderVersion.immutableCodeBucket)
      : null,

    customProviderId: customProviderVersion.customProvider.id,
    providerId: customProviderVersion.customProvider.provider?.id,

    actor: actorPresenter(customProviderVersion.creatorActor),

    containerRegistry: customProviderVersion.containerRegistry,
    containerRepository: customProviderVersion.containerRepository,
    containerTag: customProviderVersion.containerTag,

    remoteUrl: customProviderVersion.remoteUrl,
    remoteProtocol: customProviderVersion.remoteProtocol,

    config: customProviderVersion.payload?.config
      ? {
          object: 'custom_provider.config',
          schema: customProviderVersion.payload.config.schema,
          transformer: customProviderVersion.payload.config.transformer
        }
      : null,

    from: customProviderVersion.payload?.from
      ? {
          object: 'custom_provider.from',
          ...customProviderVersion.payload.from,
          env: {}
        }
      : null,

    createdAt: customProviderVersion.createdAt,
    updatedAt: customProviderVersion.updatedAt
  };
};
