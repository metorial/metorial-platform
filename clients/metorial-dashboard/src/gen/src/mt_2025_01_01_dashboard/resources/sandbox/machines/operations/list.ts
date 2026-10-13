import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesOperationsListOutput = {
  items: {
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
    instanceOperations: {
      id: string;
      kind: string;
      machineInstanceId: string;
    }[];
    requestedAt: Date;
    completedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSandboxMachinesOperationsListOutput =
  mtMap.object<SandboxMachinesOperationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
          supersededById: mtMap.objectField(
            'superseded_by_id',
            mtMap.passthrough()
          ),
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
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type SandboxMachinesOperationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  machineInstanceId?: string | string[] | undefined;
  kind?:
    | 'start'
    | 'pause'
    | 'hibernate'
    | 'restart'
    | 'terminate'
    | ('start' | 'pause' | 'hibernate' | 'restart' | 'terminate')[]
    | undefined;
  trigger?:
    | 'api'
    | 'access'
    | 'idle_policy'
    | 'paused_policy'
    | 'lifetime'
    | 'failure'
    | 'platform'
    | 'update'
    | (
        | 'api'
        | 'access'
        | 'idle_policy'
        | 'paused_policy'
        | 'lifetime'
        | 'failure'
        | 'platform'
        | 'update'
      )[]
    | undefined;
  outcome?:
    | 'active'
    | 'completed'
    | 'superseded'
    | 'failed'
    | ('active' | 'completed' | 'superseded' | 'failed')[]
    | undefined;
};

export let mapSandboxMachinesOperationsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      machineInstanceId: mtMap.objectField(
        'machine_instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      kind: mtMap.objectField(
        'kind',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      trigger: mtMap.objectField(
        'trigger',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      outcome: mtMap.objectField(
        'outcome',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

