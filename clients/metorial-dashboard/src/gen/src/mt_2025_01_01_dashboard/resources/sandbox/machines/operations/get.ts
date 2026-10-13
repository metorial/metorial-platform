import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesOperationsGetOutput = {
  object: 'sandbox.machine.operation';
  id: string;
  machineId: string;
  kind: 'start' | 'pause' | 'hibernate' | 'restart' | 'terminate';
  trigger:
    | 'api'
    | 'access'
    | 'idle_policy'
    | 'paused_policy'
    | 'lifetime'
    | 'failure'
    | 'platform'
    | 'update';
  outcome: 'active' | 'completed' | 'superseded' | 'failed';
  failure: {
    code:
      | 'provision_failed'
      | 'start_failed'
      | 'disk_unavailable'
      | 'image_unavailable'
      | 'resize_failed'
      | 'timeout'
      | 'cancelled'
      | 'internal_error';
    message: string;
  } | null;
  fromMachineInstanceId: string | null;
  supersededById: string | null;
  instanceOperations: { id: string; kind: string; machineInstanceId: string }[];
  requestedAt: Date;
  completedAt: Date | null;
};

export let mapSandboxMachinesOperationsGetOutput =
  mtMap.object<SandboxMachinesOperationsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    machineId: mtMap.objectField('machine_id', mtMap.passthrough()),
    kind: mtMap.objectField('kind', mtMap.passthrough()),
    trigger: mtMap.objectField('trigger', mtMap.passthrough()),
    outcome: mtMap.objectField('outcome', mtMap.passthrough()),
    failure: mtMap.objectField(
      'failure',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough())
      })
    ),
    fromMachineInstanceId: mtMap.objectField(
      'from_machine_instance_id',
      mtMap.passthrough()
    ),
    supersededById: mtMap.objectField('superseded_by_id', mtMap.passthrough()),
    instanceOperations: mtMap.objectField(
      'instance_operations',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          kind: mtMap.objectField('kind', mtMap.passthrough()),
          machineInstanceId: mtMap.objectField(
            'machine_instance_id',
            mtMap.passthrough()
          )
        })
      )
    ),
    requestedAt: mtMap.objectField('requested_at', mtMap.date()),
    completedAt: mtMap.objectField('completed_at', mtMap.date())
  });

