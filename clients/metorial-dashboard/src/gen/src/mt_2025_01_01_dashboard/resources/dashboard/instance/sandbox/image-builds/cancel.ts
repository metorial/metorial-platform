import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSandboxImageBuildsCancelOutput = {
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
};

export let mapDashboardInstanceSandboxImageBuildsCancelOutput =
  mtMap.object<DashboardInstanceSandboxImageBuildsCancelOutput>({
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
    diskSizeBytes: mtMap.objectField('disk_size_bytes', mtMap.passthrough()),
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
    contextUploadedAt: mtMap.objectField('context_uploaded_at', mtMap.date()),
    builtAt: mtMap.objectField('built_at', mtMap.date()),
    endedAt: mtMap.objectField('ended_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

