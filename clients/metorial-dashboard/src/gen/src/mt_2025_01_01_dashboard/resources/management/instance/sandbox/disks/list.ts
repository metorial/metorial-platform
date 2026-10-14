import { createMapper } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxDisksListOutput>(
    [
      7,
      [
        1,
        [
          'size_bytes',
          ['machine', 0, [1, ['mount_path']]],
          ['active_resize', 1, [1, ['target_size_bytes']]],
          'created_at',
          'updated_at',
          'deleted_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceSandboxDisksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { type?: 'standard' | 'root_fs' | ('standard' | 'root_fs')[] | undefined };

export let mapManagementInstanceSandboxDisksListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSandboxDisksListQuery>(0);
