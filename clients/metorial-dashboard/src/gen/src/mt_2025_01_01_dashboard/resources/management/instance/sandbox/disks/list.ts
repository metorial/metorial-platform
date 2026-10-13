import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxDisksListOutput = {
  items: {
    object: 'sandbox.disk';
    id: string;
    type: 'standard' | 'root_fs';
    name: string | null;
    status: 'active' | 'cloning' | 'deleting' | 'deleted' | 'sealed';
    region: string;
    sizeBytes: number;
    machine: { id: string; mountPath: string } | null;
    activeResize: {
      id: string;
      status: string;
      targetSizeBytes: number;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxDisksListOutput =
  mtMap.object<ManagementInstanceSandboxDisksListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          region: mtMap.objectField('region', mtMap.passthrough()),
          sizeBytes: mtMap.objectField('size_bytes', mtMap.passthrough()),
          machine: mtMap.objectField(
            'machine',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              mountPath: mtMap.objectField('mount_path', mtMap.passthrough())
            })
          ),
          activeResize: mtMap.objectField(
            'active_resize',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              targetSizeBytes: mtMap.objectField(
                'target_size_bytes',
                mtMap.passthrough()
              )
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          deletedAt: mtMap.objectField('deleted_at', mtMap.date())
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

export type ManagementInstanceSandboxDisksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { type?: 'standard' | 'root_fs' | ('standard' | 'root_fs')[] | undefined };

export let mapManagementInstanceSandboxDisksListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField(
        'type',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

