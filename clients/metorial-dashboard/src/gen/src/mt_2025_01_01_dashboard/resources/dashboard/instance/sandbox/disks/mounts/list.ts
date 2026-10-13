import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSandboxDisksMountsListOutput = {
  items: {
    object: 'sandbox.disk.mount';
    id: string;
    diskId: string;
    machineId: string | null;
    machineInstanceId: string | null;
    mountPath: string;
    status:
      | 'failed'
      | 'pending'
      | 'mounted'
      | 'recovering'
      | 'skipped'
      | 'released';
    failure: {
      code:
        | 'provision_failed'
        | 'start_failed'
        | 'disk_unavailable'
        | 'image_unavailable'
        | 'resize_failed'
        | 'timeout'
        | 'cancelled'
        | 'internal_error';
      message: string;
    } | null;
    mountedAt: Date | null;
    releasedAt: Date | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxDisksMountsListOutput =
  mtMap.object<DashboardInstanceSandboxDisksMountsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          diskId: mtMap.objectField('disk_id', mtMap.passthrough()),
          machineId: mtMap.objectField('machine_id', mtMap.passthrough()),
          machineInstanceId: mtMap.objectField(
            'machine_instance_id',
            mtMap.passthrough()
          ),
          mountPath: mtMap.objectField('mount_path', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          failure: mtMap.objectField(
            'failure',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          mountedAt: mtMap.objectField('mounted_at', mtMap.date()),
          releasedAt: mtMap.objectField('released_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceSandboxDisksMountsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceSandboxDisksMountsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

