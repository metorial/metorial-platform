import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersVersionsListOutput = {
  items: {
    object: 'custom_provider.version';
    id: string;
    status:
      'queued' | 'deploying' | 'deployment_succeeded' | 'deployment_failed';
    config: {
      object: 'custom_provider.version.config';
      schema: { type: 'json_schema'; schema: Record<string, any> };
      transformer: string;
    } | null;
    index: number;
    identifier: string;
    deployment: {
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
    };
    environments: {
      object: 'custom_provider.environment';
      id: string;
      isCurrentVersionForEnvironment: boolean;
      environment: {
        object: 'custom_provider.environment';
        id: string;
        customProviderId: string;
        providerId: string | null;
        currentProviderVersionId: string | null;
        instanceId: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }[];
    customProviderId: string;
    providerId: string | null;
    actor: {
      object: 'custom_provider.actor#preview';
      id: string;
      type: 'external' | 'system';
      identifier: string;
      name: string;
      organizationActorId: string | null;
      createdAt: Date;
    };
    containerImage?:
      | {
          containerRegistry: string;
          containerImageTag: string;
          containerImage: string;
        }
      | undefined;
    remoteMcpServer?: { url: string; transport: string } | undefined;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCustomProvidersVersionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceCustomProvidersVersionsListOutput>(
    [
      7,
      [
        1,
        [
          [
            'deployment',
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
                              [
                                1,
                                ['is_private', 'default_branch', 'created_at']
                              ]
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
          ],
          [
            'environments',
            0,
            [
              2,
              [
                1,
                [
                  'is_current_version_for_environment',
                  [
                    'environment',
                    0,
                    [
                      1,
                      [
                        'custom_provider_id',
                        'provider_id',
                        'current_provider_version_id',
                        'instance_id',
                        'created_at',
                        'updated_at'
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ],
          'custom_provider_id',
          'provider_id',
          ['actor', 0, [1, ['organization_actor_id', 'created_at']]],
          [
            'container_image',
            1,
            [
              1,
              ['container_registry', 'container_image_tag', 'container_image']
            ]
          ],
          'remote_mcp_server',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceCustomProvidersVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'queued'
    | 'deploying'
    | 'deployment_succeeded'
    | 'deployment_failed'
    | ('queued' | 'deploying' | 'deployment_succeeded' | 'deployment_failed')[]
    | undefined;
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerVersionId?: string | string[] | undefined;
  customProviderId?: string | string[] | undefined;
  customProviderDeploymentId?: string | string[] | undefined;
  customProviderEnvironmentId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceCustomProvidersVersionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceCustomProvidersVersionsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'provider_id',
              'provider_version_id',
              'custom_provider_id',
              'custom_provider_deployment_id',
              'custom_provider_environment_id',
              ['created_at', 1, 5],
              ['updated_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
