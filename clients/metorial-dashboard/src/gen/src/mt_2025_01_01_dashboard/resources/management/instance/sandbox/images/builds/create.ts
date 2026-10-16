import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxImagesBuildsCreateOutput = {
  object: 'sandbox.image.build';
  id: string;
  imageId: string;
  versionId: string;
  versionNumber: number | null;
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
  dockerfilePath: string | null;
  contextPath: string | null;
  target: string | null;
  buildArgNames: string[] | null;
  timeoutSeconds: number | null;
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

export let mapManagementInstanceSandboxImagesBuildsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxImagesBuildsCreateOutput>(
    [
      'image_id',
      'version_id',
      'version_number',
      'file_id',
      'dockerfile_path',
      'context_path',
      'build_arg_names',
      'timeout_seconds',
      'disk_size_bytes',
      'has_logs',
      'context_uploaded_at',
      'built_at',
      'ended_at',
      'created_at'
    ],
    1
  );

export type ManagementInstanceSandboxImagesBuildsCreateBody = {
  fileId: string;
  dockerfilePath?: string | undefined;
  contextPath?: string | undefined;
  target?: string | undefined;
  buildArgs?: Record<string, string> | undefined;
  timeoutSeconds?: number | undefined;
  diskSizeBytes?: number | undefined;
};

export let mapManagementInstanceSandboxImagesBuildsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxImagesBuildsCreateBody>([
    'file_id',
    'dockerfile_path',
    'context_path',
    'build_args',
    'timeout_seconds',
    'disk_size_bytes'
  ]);
