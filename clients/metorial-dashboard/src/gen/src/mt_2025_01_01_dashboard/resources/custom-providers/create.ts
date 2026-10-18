import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type CustomProvidersCreateOutput = {
  object: 'custom_provider';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  type: 'function' | 'container' | 'remote';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  draft: {
    object:
      | 'custom_provider.draft#function'
      | 'custom_provider.draft.container'
      | 'custom_provider.draft.remote';
    containerImage?:
      | {
          object: 'custom_provider.draft.container';
          containerRegistry: string;
          containerImageTag: string;
          containerImage: string;
        }
      | undefined;
    remoteMcpServer?:
      | {
          object: 'custom_provider.draft.remote';
          url: string;
          transport: 'sse' | 'streamable_http' | 'stateless';
        }
      | undefined;
    config: {
      object: 'custom_provider.draft.config';
      schema: { type: 'json_schema'; schema: Record<string, any> };
      transformer: string;
    };
  };
  scmRepo: {
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
  } | null;
  provider: {
    object: 'provider';
    id: string;
    access: 'public' | 'tenant';
    status: 'active' | 'archived' | 'deleted';
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    };
    currentVersion: {
      object: 'provider.version';
      id: string;
      version: string;
      providerId: string;
      isCurrent: boolean;
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      specificationId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    oauth: {
      status: 'enabled' | 'disabled';
      callbackUrl: string | null;
      autoRegistration: { status: 'supported' | 'unsupported' };
    } | null;
    identifier: string;
    name: string;
    description: string | null;
    slug: string;
    metadata: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
} & {
  draftBucket: {
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

export let mapCustomProvidersCreateOutput =
  /* @__PURE__ */ createMapper<CustomProvidersCreateOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              [
                'draft',
                0,
                [
                  1,
                  [
                    [
                      'container_image',
                      1,
                      [
                        1,
                        [
                          'container_registry',
                          'container_image_tag',
                          'container_image'
                        ]
                      ]
                    ],
                    'remote_mcp_server'
                  ]
                ]
              ],
              [
                'scm_repo',
                1,
                [1, ['is_private', 'default_branch', 'created_at']]
              ],
              [
                'provider',
                0,
                [
                  1,
                  [
                    [
                      'publisher',
                      0,
                      [1, ['image_url', 'created_at', 'updated_at']]
                    ],
                    [
                      'current_version',
                      1,
                      [
                        1,
                        [
                          'provider_id',
                          'is_current',
                          'specification_id',
                          'created_at',
                          'updated_at'
                        ]
                      ]
                    ],
                    ['oauth', 0, [1, ['callback_url', 'auto_registration']]],
                    'created_at',
                    'updated_at'
                  ]
                ]
              ],
              'created_at',
              'updated_at',
              [
                'draft_bucket',
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
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type CustomProvidersCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
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

export let mapCustomProvidersCreateBody =
  /* @__PURE__ */ mapObject<CustomProvidersCreateBody>([
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
  ]);
