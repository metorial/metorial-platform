import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceServersInstancesCreateOutput = {
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

export let mapDashboardInstanceServersInstancesCreateOutput =
  mtMap.object<DashboardInstanceServersInstancesCreateOutput>({
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
  });

export type DashboardInstanceServersInstancesCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  getLaunchParams?: string | undefined;
} & ({ serverId: string } | { serverVariantId: string });

export let mapDashboardInstanceServersInstancesCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
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
      )
    })
  )
]);

