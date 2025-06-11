import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceServersDeploymentsUpdateOutput = {
  object: 'server.server_deployment';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  secretId: string;
  server: {
    object: 'server#preview';
    id: string;
    name: string;
    description: string | null;
    type: 'public';
    createdAt: Date;
    updatedAt: Date;
  };
  config: {
    object: 'server.server_deployment.config';
    id: string;
    status: 'active' | 'inactive';
    secretId: string;
    createdAt: Date;
  };
  serverImplementation: {
    object: 'server.server_implementation';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    getLaunchParams: string | null;
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
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public';
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceServersDeploymentsUpdateOutput =
  mtMap.object<DashboardInstanceServersDeploymentsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
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
    config: mtMap.objectField(
      'config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    serverImplementation: mtMap.objectField(
      'server_implementation',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        getLaunchParams: mtMap.objectField(
          'get_launch_params',
          mtMap.passthrough()
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
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceServersDeploymentsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config?: Record<string, any> | undefined;
};

export let mapDashboardInstanceServersDeploymentsUpdateBody =
  mtMap.object<DashboardInstanceServersDeploymentsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    config: mtMap.objectField('config', mtMap.passthrough())
  });

