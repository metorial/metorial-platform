import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxImagesBuildsListOutput = {
  items: {
    object: 'sandbox.image.build';
    id: string;
    imageId: string;
    versionId: string;
    fileId: string | null;
    status:
      | 'preparing'
      | 'queued'
      | 'building'
      | 'processing'
      | 'replicating'
      | 'succeeded'
      | 'failed'
      | 'cancelled'
      | 'timed_out';
    failure: {
      code:
        | 'build_failed'
        | 'context_unavailable'
        | 'upload_failed'
        | 'replication_failed'
        | 'timeout'
        | 'cancelled'
        | 'internal_error';
      message: string;
    } | null;
    diskSizeBytes: number;
    regions: {
      region: string;
      status:
        | 'pending'
        | 'preparing'
        | 'queued'
        | 'building'
        | 'copying'
        | 'awaiting_source'
        | 'processing'
        | 'succeeded'
        | 'failed'
        | 'cancelled'
        | 'timed_out';
    }[];
    hasLogs: boolean;
    contextUploadedAt: Date | null;
    builtAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSandboxImagesBuildsListOutput =
  mtMap.object<ManagementInstanceSandboxImagesBuildsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          imageId: mtMap.objectField('image_id', mtMap.passthrough()),
          versionId: mtMap.objectField('version_id', mtMap.passthrough()),
          fileId: mtMap.objectField('file_id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          failure: mtMap.objectField(
            'failure',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough())
            })
          ),
          diskSizeBytes: mtMap.objectField(
            'disk_size_bytes',
            mtMap.passthrough()
          ),
          regions: mtMap.objectField(
            'regions',
            mtMap.array(
              mtMap.object({
                region: mtMap.objectField('region', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough())
              })
            )
          ),
          hasLogs: mtMap.objectField('has_logs', mtMap.passthrough()),
          contextUploadedAt: mtMap.objectField(
            'context_uploaded_at',
            mtMap.date()
          ),
          builtAt: mtMap.objectField('built_at', mtMap.date()),
          endedAt: mtMap.objectField('ended_at', mtMap.date()),
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

export type ManagementInstanceSandboxImagesBuildsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'preparing'
    | 'queued'
    | 'building'
    | 'processing'
    | 'replicating'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'timed_out'
    | (
        | 'preparing'
        | 'queued'
        | 'building'
        | 'processing'
        | 'replicating'
        | 'succeeded'
        | 'failed'
        | 'cancelled'
        | 'timed_out'
      )[]
    | undefined;
};

export let mapManagementInstanceSandboxImagesBuildsListQuery = mtMap.union([
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

