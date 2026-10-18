import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCustomProvidersVersionsCreateOutput = {
  object: 'custom_provider.version';
  id: string;
  status: 'queued' | 'deploying' | 'deployment_succeeded' | 'deployment_failed';
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
};

export let mapDashboardInstanceCustomProvidersVersionsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceCustomProvidersVersionsCreateOutput>(
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
        [1, ['container_registry', 'container_image_tag', 'container_image']]
      ],
      'remote_mcp_server',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceCustomProvidersVersionsCreateBody = {
  customProviderId: string;
  from:
    | {
        type: 'container';
        imageRef: string;
        username?: string | undefined;
        password?: string | undefined;
      }
    | {
        type: 'remote';
        remoteUrl: string;
        oauthConfig?: Record<string, any> | undefined;
        protocol: 'sse' | 'streamable_http' | 'stateless';
      }
    | {
        type: 'function';
        files: {
          filename: string;
          content: string;
          encoding?: 'utf-8' | 'base64' | undefined;
        }[];
        env: Record<string, string>;
        runtime:
          | { identifier: 'nodejs'; version: '24.x' | '22.x' }
          | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
      }
    | {
        type: 'function';
        env: Record<string, string>;
        runtime:
          | { identifier: 'nodejs'; version: '24.x' | '22.x' }
          | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
        repository:
          | { repositoryId: string; branch: string; path?: string | undefined }
          | {
              type: 'git';
              repositoryUrl: string;
              branch: string;
              path?: string | undefined;
            };
      };
  config?: { schema: Record<string, any>; transformer: string } | undefined;
};

export let mapDashboardInstanceCustomProvidersVersionsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceCustomProvidersVersionsCreateBody>(
    [
      'custom_provider_id',
      [
        'from',
        0,
        [
          3,
          [
            [
              0,
              [
                1,
                [
                  'image_ref',
                  'remote_url',
                  'oauth_config',
                  [
                    'repository',
                    0,
                    [3, [[0, [1, ['repository_id', 'repository_url']]]]]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  );
