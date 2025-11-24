import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersCreateOutput = {
  object: 'custom_server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  type: 'remote' | 'managed';
  publicationStatus: 'public' | 'private';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  server: {
    object: 'server#preview';
    id: string;
    name: string;
    description: string | null;
    type: 'public' | 'custom';
    createdAt: Date;
    updatedAt: Date;
  };
  serverVariant: {
    object: 'server.server_variant#preview';
    id: string;
    identifier: string;
    serverId: string;
    source:
      | { type: 'docker'; docker: { image: string } }
      | { type: 'remote'; remote: { domain: string } };
    createdAt: Date;
  };
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
} & {
  fork: { status: 'disabled' } | { status: 'enabled'; templateId: string };
  repository: {
    object: 'scm.repo';
    id: string;
    name: string;
    owner: string;
    url: string;
    defaultBranch: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

export let mapCustomServersCreateOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      publicationStatus: mtMap.objectField(
        'publication_status',
        mtMap.passthrough()
      ),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      server: mtMap.objectField(
        'server',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      serverVariant: mtMap.objectField(
        'server_variant',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          serverId: mtMap.objectField('server_id', mtMap.passthrough()),
          source: mtMap.objectField(
            'source',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  docker: mtMap.objectField(
                    'docker',
                    mtMap.object({
                      image: mtMap.objectField('image', mtMap.passthrough())
                    })
                  ),
                  remote: mtMap.objectField(
                    'remote',
                    mtMap.object({
                      domain: mtMap.objectField('domain', mtMap.passthrough())
                    })
                  )
                })
              )
            ])
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      ),
      currentVersionId: mtMap.objectField(
        'current_version_id',
        mtMap.passthrough()
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
      fork: mtMap.objectField(
        'fork',
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              status: mtMap.objectField('status', mtMap.passthrough()),
              templateId: mtMap.objectField('template_id', mtMap.passthrough())
            })
          )
        ])
      ),
      repository: mtMap.objectField(
        'repository',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          owner: mtMap.objectField('owner', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough()),
          defaultBranch: mtMap.objectField(
            'default_branch',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    })
  )
]);

export type CustomServersCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  implementation:
    | {
        type: 'remote';
        remoteServer: {
          remoteUrl: string;
          remoteProtocol?: 'sse' | 'streamable_http' | undefined;
        };
        config?:
          | { schema?: any | undefined; getLaunchParams?: string | undefined }
          | undefined;
      }
    | {
        type: 'managed';
        managedServer?:
          | {
              templateId?: string | undefined;
              repository?: { repositoryId: string; path: string } | undefined;
            }
          | undefined;
        config?:
          | { schema?: any | undefined; getLaunchParams?: string | undefined }
          | undefined;
      };
};

export let mapCustomServersCreateBody = mtMap.object<CustomServersCreateBody>({
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  implementation: mtMap.objectField(
    'implementation',
    mtMap.union([
      mtMap.unionOption(
        'object',
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          remoteServer: mtMap.objectField(
            'remote_server',
            mtMap.object({
              remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
              remoteProtocol: mtMap.objectField(
                'remote_protocol',
                mtMap.passthrough()
              )
            })
          ),
          config: mtMap.objectField(
            'config',
            mtMap.object({
              schema: mtMap.objectField('schema', mtMap.passthrough()),
              getLaunchParams: mtMap.objectField(
                'getLaunchParams',
                mtMap.passthrough()
              )
            })
          ),
          managedServer: mtMap.objectField(
            'managed_server',
            mtMap.object({
              templateId: mtMap.objectField('template_id', mtMap.passthrough()),
              repository: mtMap.objectField(
                'repository',
                mtMap.object({
                  repositoryId: mtMap.objectField(
                    'repository_id',
                    mtMap.passthrough()
                  ),
                  path: mtMap.objectField('path', mtMap.passthrough())
                })
              )
            })
          )
        })
      )
    ])
  )
});

