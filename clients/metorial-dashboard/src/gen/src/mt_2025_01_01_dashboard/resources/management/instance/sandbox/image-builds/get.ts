import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxImageBuildsGetOutput = {
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

export let mapManagementInstanceSandboxImageBuildsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxImageBuildsGetOutput>(
    [
      'image_id',
      'version_id',
      'file_id',
      'disk_size_bytes',
      'has_logs',
      'context_uploaded_at',
      'built_at',
      'ended_at',
      'created_at'
    ],
    1
  );
