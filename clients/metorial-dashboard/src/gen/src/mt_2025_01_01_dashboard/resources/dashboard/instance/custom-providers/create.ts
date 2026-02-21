import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersCreateOutput = {
  object: 'custom_provider';
  id: string;
  status: string | null;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  provider: {
    object: 'provider';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    publisher: {
      object: 'provider.publisher';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      imageUrl: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    currentVersion: {
      object: 'provider.version';
      id: string;
      version: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceCustomProvidersCreateOutput =
  mtMap.object<DashboardInstanceCustomProvidersCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        publisher: mtMap.objectField(
          'publisher',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
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
            status: mtMap.objectField('status', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceCustomProvidersCreateBody = {
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

export let mapDashboardInstanceCustomProvidersCreateBody =
  mtMap.object<DashboardInstanceCustomProvidersCreateBody>({
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

