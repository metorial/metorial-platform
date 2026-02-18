import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersVersionsCreateOutput = {
  object: 'custom_provider.version';
  id: string;
  status: string | null;
  index: number | null;
  identifier: string | null;
  deployment: {
    object: 'custom_provider.deployment';
    id: string;
    status: string | null;
    trigger: string | null;
    customProviderId: string;
    providerId: string | null;
    customProviderVersionId: string | null;
    commit: {
      id: string;
      type: string | null;
      message: string | null;
      createdAt: Date;
    } | null;
    actor: {
      id: string;
      name: string | null;
      type: string | null;
      organizationActorId: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  environments: {
    object: 'custom_provider.environment';
    id: string;
    isCurrentVersionForEnvironment: boolean | null;
    environment: {
      object: 'custom_provider.environment';
      id: string;
      customProviderId: string;
      providerId: string | null;
      currentProviderVersionId: string | null;
      instanceId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }[];
  customProviderId: string;
  providerId: string | null;
  actor: {
    id: string;
    name: string | null;
    type: string | null;
    organizationActorId: string | null;
  } | null;
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
            id: mtMap.objectField('id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            message: mtMap.objectField('message', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date())
          })
        ),
        actor: mtMap.objectField(
          'actor',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            organizationActorId: mtMap.objectField(
              'organization_actor_id',
              mtMap.passthrough()
            )
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
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        organizationActorId: mtMap.objectField(
          'organization_actor_id',
          mtMap.passthrough()
        )
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceCustomProvidersVersionsCreateBody = {
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
        config?: Record<string, any> | undefined;
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
      };
  config?: { schema: Record<string, any>; transformer: string } | undefined;
};

export let mapManagementInstanceCustomProvidersVersionsCreateBody =
  mtMap.object<ManagementInstanceCustomProvidersVersionsCreateBody>({
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
            config: mtMap.objectField('config', mtMap.passthrough()),
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

