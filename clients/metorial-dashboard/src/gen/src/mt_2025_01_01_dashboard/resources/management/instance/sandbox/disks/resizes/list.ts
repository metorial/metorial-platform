import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxDisksResizesListOutput = {
  items: {
    object: 'sandbox.disk.resize';
    id: string;
    diskId: string;
    status:
      | 'pending'
      | 'draining'
      | 'resizing'
      | 'verifying'
      | 'restarting'
      | 'complete'
      | 'failed';
    originalSizeBytes: number;
    targetSizeBytes: number;
    machineIds: string[];
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
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxDisksResizesListOutput =
  mtMap.object<ManagementInstanceSandboxDisksResizesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          diskId: mtMap.objectField('disk_id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          originalSizeBytes: mtMap.objectField(
            'original_size_bytes',
            mtMap.passthrough()
          ),
          targetSizeBytes: mtMap.objectField(
            'target_size_bytes',
            mtMap.passthrough()
          ),
          machineIds: mtMap.objectField(
            'machine_ids',
            mtMap.array(mtMap.passthrough())
          ),
          failure: mtMap.objectField(
            'failure',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          completedAt: mtMap.objectField('completed_at', mtMap.date())
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

export type ManagementInstanceSandboxDisksResizesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'pending'
    | 'draining'
    | 'resizing'
    | 'verifying'
    | 'restarting'
    | 'complete'
    | 'failed'
    | (
        | 'pending'
        | 'draining'
        | 'resizing'
        | 'verifying'
        | 'restarting'
        | 'complete'
        | 'failed'
      )[]
    | undefined;
};

export let mapManagementInstanceSandboxDisksResizesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

