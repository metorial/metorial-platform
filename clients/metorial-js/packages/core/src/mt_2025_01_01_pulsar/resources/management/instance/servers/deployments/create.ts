import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceServersDeploymentsCreateOutput = {
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  serverId: string;
  secretId: string;
  serverInstance: {
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    getLaunchParams: string | null;
    serverId: string;
    serverVariantId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceServersDeploymentsCreateOutput =
  mtMap.object<ManagementInstanceServersDeploymentsCreateOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    serverId: mtMap.objectField('server_id', mtMap.passthrough()),
    secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
    serverInstance: mtMap.objectField(
      'server_instance',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        getLaunchParams: mtMap.objectField(
          'get_launch_params',
          mtMap.passthrough()
        ),
        serverId: mtMap.objectField('server_id', mtMap.passthrough()),
        serverVariantId: mtMap.objectField(
          'server_variant_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceServersDeploymentsCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config: Record<string, any>;
} & (
  | { serverInstanceId: string }
  | {
      serverInstance: {
        name?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
        getLaunchParams?: string | undefined;
      } & ({ serverId: string } | { serverVariantId: string });
    }
  | { serverId: string }
  | { serverVariantId: string }
);

export let mapManagementInstanceServersDeploymentsCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      config: mtMap.objectField('config', mtMap.passthrough()),
      serverInstanceId: mtMap.objectField(
        'server_instance_id',
        mtMap.passthrough()
      ),
      serverInstance: mtMap.objectField(
        'server_instance',
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              getLaunchParams: mtMap.objectField(
                'get_launch_params',
                mtMap.passthrough()
              ),
              serverId: mtMap.objectField('server_id', mtMap.passthrough()),
              serverVariantId: mtMap.objectField(
                'server_variant_id',
                mtMap.passthrough()
              )
            })
          )
        ])
      ),
      serverId: mtMap.objectField('server_id', mtMap.passthrough()),
      serverVariantId: mtMap.objectField(
        'server_variant_id',
        mtMap.passthrough()
      )
    })
  )
]);

