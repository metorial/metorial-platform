import { mtMap } from '@metorial/util-resource-mapper';

export type CustomProvidersCreateOutput = {
  object: 'custom_provider';
  id: string;
  status: string;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  draft: {
    containerImage?:
      | {
          containerRegistry: string;
          containerImageTag: string;
          containerImage: string;
        }
      | undefined;
    remoteMcpServer?:
      | { url: string; transport: 'sse' | 'streamable_http' }
      | undefined;
  };
  scmRepo: {
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
  } | null;
  provider: {
    object: 'provider';
    id: string;
    access: string;
    status: string;
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      slug: string;
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
    type: {
      object: 'provider.type';
      id: string;
      name: string;
      config:
        | { status: 'enabled'; read: { status: 'enabled' | 'disabled' } }
        | { status: 'disabled' };
      auth:
        | {
            status: 'enabled';
            oauth:
              | {
                  status: 'enabled';
                  oauthCallbackUrl: string | null;
                  oauthAutoRegistration: {
                    status: 'supported' | 'unsupported';
                  };
                }
              | { status: 'disabled' };
            export: { status: 'enabled' | 'disabled' };
            import: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled' };
      createdAt: Date;
    };
    oauth: {
      status: string;
      callbackUrl: string | null;
      autoRegistration: { status: 'enabled' | 'disabled' };
    } | null;
    identifier: string;
    tag: string;
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
};

export let mapCustomProvidersCreateOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      draft: mtMap.objectField(
        'draft',
        mtMap.object({
          containerImage: mtMap.objectField(
            'container_image',
            mtMap.object({
              containerRegistry: mtMap.objectField(
                'container_registry',
                mtMap.passthrough()
              ),
              containerImageTag: mtMap.objectField(
                'container_image_tag',
                mtMap.passthrough()
              ),
              containerImage: mtMap.objectField(
                'container_image',
                mtMap.passthrough()
              )
            })
          ),
          remoteMcpServer: mtMap.objectField(
            'remote_mcp_server',
            mtMap.object({
              url: mtMap.objectField('url', mtMap.passthrough()),
              transport: mtMap.objectField('transport', mtMap.passthrough())
            })
          )
        })
      ),
      scmRepo: mtMap.objectField(
        'scm_repo',
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
      provider: mtMap.objectField(
        'provider',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          access: mtMap.objectField('access', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          publisher: mtMap.objectField(
            'publisher',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          currentVersion: mtMap.objectField(
            'current_version',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              version: mtMap.objectField('version', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              specificationId: mtMap.objectField(
                'specification_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          type: mtMap.objectField(
            'type',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              config: mtMap.objectField(
                'config',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      read: mtMap.objectField(
                        'read',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          )
                        })
                      )
                    })
                  )
                ])
              ),
              auth: mtMap.objectField(
                'auth',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      oauth: mtMap.objectField(
                        'oauth',
                        mtMap.union([
                          mtMap.unionOption(
                            'object',
                            mtMap.object({
                              status: mtMap.objectField(
                                'status',
                                mtMap.passthrough()
                              ),
                              oauthCallbackUrl: mtMap.objectField(
                                'oauth_callback_url',
                                mtMap.passthrough()
                              ),
                              oauthAutoRegistration: mtMap.objectField(
                                'oauth_auto_registration',
                                mtMap.object({
                                  status: mtMap.objectField(
                                    'status',
                                    mtMap.passthrough()
                                  )
                                })
                              )
                            })
                          )
                        ])
                      ),
                      export: mtMap.objectField(
                        'export',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          )
                        })
                      ),
                      import: mtMap.objectField(
                        'import',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          )
                        })
                      )
                    })
                  )
                ])
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          oauth: mtMap.objectField(
            'oauth',
            mtMap.object({
              status: mtMap.objectField('status', mtMap.passthrough()),
              callbackUrl: mtMap.objectField(
                'callback_url',
                mtMap.passthrough()
              ),
              autoRegistration: mtMap.objectField(
                'auto_registration',
                mtMap.object({
                  status: mtMap.objectField('status', mtMap.passthrough())
                })
              )
            })
          ),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          tag: mtMap.objectField('tag', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      draftBucket: mtMap.objectField(
        'draft_bucket',
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
                  isPrivate: mtMap.objectField(
                    'is_private',
                    mtMap.passthrough()
                  ),
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
      )
    })
  )
]);

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
        protocol: 'sse' | 'streamable_http';
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
  mtMap.object<CustomProvidersCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    from: mtMap.objectField(
      'from',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            imageRef: mtMap.objectField('image_ref', mtMap.passthrough()),
            username: mtMap.objectField('username', mtMap.passthrough()),
            password: mtMap.objectField('password', mtMap.passthrough()),
            remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
            oauthConfig: mtMap.objectField('oauth_config', mtMap.passthrough()),
            protocol: mtMap.objectField('protocol', mtMap.passthrough()),
            files: mtMap.objectField(
              'files',
              mtMap.array(
                mtMap.object({
                  filename: mtMap.objectField('filename', mtMap.passthrough()),
                  content: mtMap.objectField('content', mtMap.passthrough()),
                  encoding: mtMap.objectField('encoding', mtMap.passthrough())
                })
              )
            ),
            env: mtMap.objectField('env', mtMap.passthrough()),
            runtime: mtMap.objectField(
              'runtime',
              mtMap.union([
                mtMap.unionOption(
                  'object',
                  mtMap.object({
                    identifier: mtMap.objectField(
                      'identifier',
                      mtMap.passthrough()
                    ),
                    version: mtMap.objectField('version', mtMap.passthrough())
                  })
                )
              ])
            ),
            repository: mtMap.objectField(
              'repository',
              mtMap.union([
                mtMap.unionOption(
                  'object',
                  mtMap.object({
                    repositoryId: mtMap.objectField(
                      'repository_id',
                      mtMap.passthrough()
                    ),
                    branch: mtMap.objectField('branch', mtMap.passthrough()),
                    path: mtMap.objectField('path', mtMap.passthrough()),
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    repositoryUrl: mtMap.objectField(
                      'repository_url',
                      mtMap.passthrough()
                    )
                  })
                )
              ])
            )
          })
        )
      ])
    ),
    config: mtMap.objectField(
      'config',
      mtMap.object({
        schema: mtMap.objectField('schema', mtMap.passthrough()),
        transformer: mtMap.objectField('transformer', mtMap.passthrough())
      })
    )
  });

