import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersVersionsCreateOutput = {
  object: 'custom_provider.version';
  id: string;
  status: string;
  index: number;
  identifier: string;
  deployment: {
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
    type: string;
    identifier: string;
    name: string;
    organizationActorId: string | null;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceCustomProvidersVersionsCreateOutput =
  mtMap.object<ManagementInstanceCustomProvidersVersionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    index: mtMap.objectField('index', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    deployment: mtMap.objectField(
      'deployment',
      mtMap.object({
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
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
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
                externalId: mtMap.objectField(
                  'external_id',
                  mtMap.passthrough()
                ),
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
      })
    ),
    environments: mtMap.objectField(
      'environments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          isCurrentVersionForEnvironment: mtMap.objectField(
            'is_current_version_for_environment',
            mtMap.passthrough()
          ),
          environment: mtMap.objectField(
            'environment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              customProviderId: mtMap.objectField(
                'custom_provider_id',
                mtMap.passthrough()
              ),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              currentProviderVersionId: mtMap.objectField(
                'current_provider_version_id',
                mtMap.passthrough()
              ),
              instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        })
      )
    ),
    customProviderId: mtMap.objectField(
      'custom_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceCustomProvidersVersionsCreateBody = {
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

export let mapManagementInstanceCustomProvidersVersionsCreateBody =
  mtMap.object<ManagementInstanceCustomProvidersVersionsCreateBody>({
    customProviderId: mtMap.objectField(
      'custom_provider_id',
      mtMap.passthrough()
    ),
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

