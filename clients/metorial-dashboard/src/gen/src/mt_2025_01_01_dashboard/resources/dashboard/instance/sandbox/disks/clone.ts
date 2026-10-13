import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSandboxDisksCloneOutput = {
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

export let mapDashboardInstanceSandboxDisksCloneOutput =
  mtMap.object<DashboardInstanceSandboxDisksCloneOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    region: mtMap.objectField('region', mtMap.passthrough()),
    sizeBytes: mtMap.objectField('size_bytes', mtMap.passthrough()),
    machine: mtMap.objectField(
      'machine',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        mountPath: mtMap.objectField('mount_path', mtMap.passthrough())
      })
    ),
    activeResize: mtMap.objectField(
      'active_resize',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        targetSizeBytes: mtMap.objectField(
          'target_size_bytes',
          mtMap.passthrough()
        )
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date())
  });

export type DashboardInstanceSandboxDisksCloneBody = {
  name?: string | undefined;
  idempotencyKey?: string | undefined;
};

export let mapDashboardInstanceSandboxDisksCloneBody =
  mtMap.object<DashboardInstanceSandboxDisksCloneBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    idempotencyKey: mtMap.objectField('idempotency_key', mtMap.passthrough())
  });

