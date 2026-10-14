import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxImageBuildsListOutput = {
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

export let mapDashboardInstanceSandboxImageBuildsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImageBuildsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSandboxImageBuildsListQuery = {
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

export let mapDashboardInstanceSandboxImageBuildsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSandboxImageBuildsListQuery>(0);
