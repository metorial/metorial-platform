import { mtMap } from '@metorial/util-resource-mapper';

export type SandboxMachinesErrorsListOutput = {
  items: {
    object: 'sandbox.machine.error';
    id: string;
    machineId: string;
    machineInstanceId: string;
    operationId: string;
    eventId: string | null;
    kind: string;
    stage: 'prepare' | 'initialize';
    reason: 'failed' | 'timed_out';
    code: string;
    message: string;
    exitCode: number | null;
    durationMs: number | null;
    stdout: string | null;
    occurredAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSandboxMachinesErrorsListOutput =
  mtMap.object<SandboxMachinesErrorsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          machineId: mtMap.objectField('machine_id', mtMap.passthrough()),
          machineInstanceId: mtMap.objectField(
            'machine_instance_id',
            mtMap.passthrough()
          ),
          operationId: mtMap.objectField('operation_id', mtMap.passthrough()),
          eventId: mtMap.objectField('event_id', mtMap.passthrough()),
          kind: mtMap.objectField('kind', mtMap.passthrough()),
          stage: mtMap.objectField('stage', mtMap.passthrough()),
          reason: mtMap.objectField('reason', mtMap.passthrough()),
          code: mtMap.objectField('code', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          exitCode: mtMap.objectField('exit_code', mtMap.passthrough()),
          durationMs: mtMap.objectField('duration_ms', mtMap.passthrough()),
          stdout: mtMap.objectField('stdout', mtMap.passthrough()),
          occurredAt: mtMap.objectField('occurred_at', mtMap.date())
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

export type SandboxMachinesErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { machineInstanceId?: string | string[] | undefined };

export let mapSandboxMachinesErrorsListQuery = mtMap.union([
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
      )
    })
  )
]);

