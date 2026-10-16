import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersDeploymentsGetOutput = {
  object: 'custom_provider.deployment';
  id: string;
  status: 'failed' | 'queued' | 'deploying' | 'succeeded';
  trigger: 'manual' | 'system' | 'scm';
  customProviderId: string;
  providerId: string | null;
  customProviderVersionId: string | null;
  commit: {
    object: 'custom_provider.deployment.commit';
    id: string;
    type:
      | 'create_version'
      | 'merge_version_into_environment'
      | 'rollback_to_version';
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
          type: 'github' | 'gitlab' | 'bitbucket';
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
    type: 'external' | 'system';
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
        type: 'github' | 'gitlab' | 'bitbucket';
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
} & {
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
          type: 'github' | 'gitlab' | 'bitbucket';
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
};

export let mapManagementInstanceCustomProvidersDeploymentsGetOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceCustomProvidersDeploymentsGetOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'custom_provider_id',
              'provider_id',
              'custom_provider_version_id',
              ['commit', 0, [1, ['created_at']]],
              [
                'immutable_bucket',
                1,
                [
                  1,
                  [
                    'is_immutable',
                    'is_read_only',
                    [
                      'scm_repo_link',
                      1,
                      [
                        1,
                        [
                          'is_linked',
                          [
                            'repository',
                            0,
                            [1, ['is_private', 'default_branch', 'created_at']]
                          ]
                        ]
                      ]
                    ],
                    'created_at'
                  ]
                ]
              ],
              ['actor', 0, [1, ['organization_actor_id', 'created_at']]],
              [
                'scm_push',
                1,
                [
                  1,
                  [
                    ['actor', 0, [1, ['external_id']]],
                    ['commit', 0, [1, ['created_at']]],
                    [
                      'repository',
                      0,
                      [1, ['is_private', 'default_branch', 'created_at']]
                    ],
                    'created_at'
                  ]
                ]
              ],
              'created_at',
              'updated_at'
            ]
          ]
        ]
      ]
    ],
    1
  );
