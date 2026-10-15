import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxImagesBuildsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxImagesBuildsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesBuildsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSandboxImagesBuildsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  imageVersionId?: string | string[] | undefined;
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

export let mapDashboardInstanceSandboxImagesBuildsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImagesBuildsListQuery>([
    3,
    [[0, [1, ['image_version_id']]]]
  ]);
