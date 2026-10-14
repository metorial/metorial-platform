import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxDisksCloneOutput = {
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

export let mapManagementInstanceSandboxDisksCloneOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxDisksCloneOutput>(
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

export type ManagementInstanceSandboxDisksCloneBody = {
  name?: string | undefined;
  idempotencyKey?: string | undefined;
};

export let mapManagementInstanceSandboxDisksCloneBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxDisksCloneBody>([
    'idempotency_key'
  ]);
