import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxDisksCreateOutput = {
  object: 'sandbox.disk';
  id: string;
  type: 'standard' | 'root_fs';
  name: string | null;
  status: 'active' | 'cloning' | 'deleting' | 'deleted' | 'sealed';
  region: string;
  sizeBytes: number;
  machine: { id: string; mountPath: string } | null;
  activeResize: { id: string; status: string; targetSizeBytes: number } | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export let mapDashboardInstanceSandboxDisksCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxDisksCreateOutput>(
    [
      'size_bytes',
      ['machine', 0, [1, ['mount_path']]],
      ['active_resize', 1, [1, ['target_size_bytes']]],
      'created_at',
      'updated_at',
      'deleted_at'
    ],
    1
  );

export type DashboardInstanceSandboxDisksCreateBody = {
  region: string;
  name?: string | undefined;
  sizeBytes?: number | undefined;
  idempotencyKey?: string | undefined;
};

export let mapDashboardInstanceSandboxDisksCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxDisksCreateBody>([
    'size_bytes',
    'idempotency_key'
  ]);
