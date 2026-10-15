import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SandboxDisksCloneOutput = {
  object: 'sandbox.disk';
  metadata: Record<string, any>;
  id: string;
  type: 'standard' | 'root_fs';
  name: string | null;
  status: 'active' | 'cloning' | 'deleting' | 'deleted' | 'sealed';
  region: string;
  sizeBytes: number | null;
  machine: {
    id: string;
    name: string | null;
    slug: string | null;
    mountPath: string;
  } | null;
  activeResize: { id: string; status: string; targetSizeBytes: number } | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export let mapSandboxDisksCloneOutput =
  /* @__PURE__ */ mapObject<SandboxDisksCloneOutput>(
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

export type SandboxDisksCloneBody = {
  metadata?: Record<string, any> | undefined;
  name?: string | undefined;
};

export let mapSandboxDisksCloneBody =
  /* @__PURE__ */ createMapper<SandboxDisksCloneBody>(0);
