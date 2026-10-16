import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersArchiveOutput = {
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
          transport: 'sse' | 'streamable_http';
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

export let mapManagementInstanceCustomProvidersArchiveOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceCustomProvidersArchiveOutput>(
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
