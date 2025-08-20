import { mtMap } from '@metorial/util-resource-mapper';

export type ServersVariantsGetOutput = {
  object: 'server.server_variant';
  id: string;
  status: 'active' | 'inactive';
  identifier: string;
  server: {
    object: 'server#preview';
    id: string;
    name: string;
    description: string | null;
    type: 'public' | 'custom';
    createdAt: Date;
    updatedAt: Date;
  };
  currentVersion: {
    object: 'server.server_version';
    id: string;
    identifier: string;
    serverId: string;
    serverVariantId: string;
    getLaunchParams: string;
    source:
      | { type: 'docker'; docker: { image: string; tag: string } }
      | { type: 'remote'; remote: { domain: string } };
    schema: Record<string, any>;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public' | 'custom';
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
  } | null;
  source:
    | { type: 'docker'; docker: { image: string } }
    | { type: 'remote'; remote: { domain: string } };
  createdAt: Date;
};

export let mapServersVariantsGetOutput = mtMap.object<ServersVariantsGetOutput>(
  {
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
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
    currentVersion: mtMap.objectField(
      'current_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        serverId: mtMap.objectField('server_id', mtMap.passthrough()),
        serverVariantId: mtMap.objectField(
          'server_variant_id',
          mtMap.passthrough()
        ),
        getLaunchParams: mtMap.objectField(
          'get_launch_params',
          mtMap.passthrough()
        ),
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
                    image: mtMap.objectField('image', mtMap.passthrough()),
                    tag: mtMap.objectField('tag', mtMap.passthrough())
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
        schema: mtMap.objectField('schema', mtMap.passthrough()),
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
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
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
  }
);

