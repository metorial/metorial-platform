import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomServersUpdateOutput = {
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
};

export let mapManagementInstanceCustomServersUpdateOutput =
  mtMap.object<ManagementInstanceCustomServersUpdateOutput>({
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
    deletedAt: mtMap.objectField('deleted_at', mtMap.date())
  });

export type ManagementInstanceCustomServersUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceCustomServersUpdateBody =
  mtMap.object<ManagementInstanceCustomServersUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

