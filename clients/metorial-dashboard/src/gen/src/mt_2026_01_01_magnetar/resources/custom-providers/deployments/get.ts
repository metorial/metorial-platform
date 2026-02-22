import { mtMap } from '@metorial/util-resource-mapper';

export type CustomProvidersDeploymentsGetOutput = {
  object: 'custom_provider.deployment';
  id: string;
  status: string;
  trigger: string;
  customProviderId: string;
  providerId: string | null;
  customProviderVersionId: string | null;
  commit: {
    object: 'custom_provider.deployment.commit';
    id: string;
    type: string;
    message: string | null;
    createdAt: Date;
  } | null;
  immutableBucket: {
    object: 'bucket';
    id: string;
    isImmutable: boolean;
    isReadOnly: boolean;
    scmRepoLink: {
      object: 'bucket.scm_repo';
      isLinked: 'true';
      path: string | null;
      repository: {
        object: 'scm.repository';
        id: string;
        provider: {
          object: 'scm.provider';
          type: 'github' | 'gitlab';
          id: string;
          name: string;
          owner: string;
        };
        url: string;
        isPrivate: boolean;
        defaultBranch: string;
        createdAt: Date;
      };
    } | null;
    createdAt: Date;
  } | null;
  actor: {
    object: 'custom_provider.actor#preview';
    id: string;
    type: string;
    identifier: string;
    name: string;
    organizationActorId: string | null;
    createdAt: Date;
  };
  scmPush: {
    object: 'scm.push';
    id: string;
    actor: {
      object: 'scm.actor';
      id: string;
      externalId: string | null;
      name: string | null;
      email: string | null;
    };
    commit: {
      object: 'scm.commit';
      id: string;
      sha: string;
      branch: string;
      message: string | null;
      createdAt: Date;
    };
    repository: {
      object: 'scm.repository';
      id: string;
      provider: {
        object: 'scm.provider';
        type: 'github' | 'gitlab';
        id: string;
        name: string;
        owner: string;
      };
      url: string;
      isPrivate: boolean;
      defaultBranch: string;
      createdAt: Date;
    };
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCustomProvidersDeploymentsGetOutput =
  mtMap.object<CustomProvidersDeploymentsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    trigger: mtMap.objectField('trigger', mtMap.passthrough()),
    customProviderId: mtMap.objectField(
      'custom_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    customProviderVersionId: mtMap.objectField(
      'custom_provider_version_id',
      mtMap.passthrough()
    ),
    commit: mtMap.objectField(
      'commit',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    immutableBucket: mtMap.objectField(
      'immutable_bucket',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isImmutable: mtMap.objectField('is_immutable', mtMap.passthrough()),
        isReadOnly: mtMap.objectField('is_read_only', mtMap.passthrough()),
        scmRepoLink: mtMap.objectField(
          'scm_repo_link',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            isLinked: mtMap.objectField('is_linked', mtMap.passthrough()),
            path: mtMap.objectField('path', mtMap.passthrough()),
            repository: mtMap.objectField(
              'repository',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                provider: mtMap.objectField(
                  'provider',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    owner: mtMap.objectField('owner', mtMap.passthrough())
                  })
                ),
                url: mtMap.objectField('url', mtMap.passthrough()),
                isPrivate: mtMap.objectField('is_private', mtMap.passthrough()),
                defaultBranch: mtMap.objectField(
                  'default_branch',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    actor: mtMap.objectField(
      'actor',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        organizationActorId: mtMap.objectField(
          'organization_actor_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    scmPush: mtMap.objectField(
      'scm_push',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        actor: mtMap.objectField(
          'actor',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            externalId: mtMap.objectField('external_id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            email: mtMap.objectField('email', mtMap.passthrough())
          })
        ),
        commit: mtMap.objectField(
          'commit',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            sha: mtMap.objectField('sha', mtMap.passthrough()),
            branch: mtMap.objectField('branch', mtMap.passthrough()),
            message: mtMap.objectField('message', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date())
          })
        ),
        repository: mtMap.objectField(
          'repository',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            provider: mtMap.objectField(
              'provider',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                owner: mtMap.objectField('owner', mtMap.passthrough())
              })
            ),
            url: mtMap.objectField('url', mtMap.passthrough()),
            isPrivate: mtMap.objectField('is_private', mtMap.passthrough()),
            defaultBranch: mtMap.objectField(
              'default_branch',
              mtMap.passthrough()
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

