import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sandboxMachineOperationService } from '@metorial/module-sandbox';
import { sandboxMachineOperationPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxReadScopes } from './_middleware';
import { sandboxMachineGroup } from './machine';

let operationKinds = ['start', 'pause', 'hibernate', 'restart', 'terminate'] as const;

let operationTriggers = [
  'api',
  'access',
  'idle_policy',
  'paused_policy',
  'lifetime',
  'failure',
  'platform',
  'update'
] as const;

let operationOutcomes = ['active', 'completed', 'superseded', 'failed'] as const;

let multi = <T extends string>(values: readonly [T, ...T[]]) =>
  v.optional(v.union([v.enumOf([...values]), v.array(v.enumOf([...values]))]));

export let sandboxMachineOperationController = Controller.create(
  {
    name: 'Sandbox machine operations',
    description:
      'Operations record each start, pause, hibernate, restart, terminate, update, or upgrade a machine went through.'
  },
  {
    list: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/operations',
          'sandbox.machines.operations.list'
        ),
        {
          name: 'List machine operations',
          description: 'Returns a paginated list of the operations of a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxMachineOperationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            machine_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only operations that involved these instances'
            }),
            kind: multi(operationKinds),
            trigger: multi(operationTriggers),
            outcome: multi(operationOutcomes)
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxMachineOperationService.list({
          machine: ctx.machine,
          instanceIds: normalizeArrayParam(ctx.query.machine_instance_id),
          kinds: normalizeArrayParam(ctx.query.kind),
          triggers: normalizeArrayParam(ctx.query.trigger),
          outcomes: normalizeArrayParam(ctx.query.outcome)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, operation =>
          sandboxMachineOperationPresenter.present({ operation })
        );
      }),

    get: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/operations/:operationId',
          'sandbox.machines.operations.get'
        ),
        {
          name: 'Get machine operation',
          description: 'Retrieves an operation of a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxMachineOperationPresenter)
      .do(async ctx => {
        let operation = await sandboxMachineOperationService.get({
          machine: ctx.machine,
          operationId: requirePathParam(ctx.params, 'operationId')
        });

        return sandboxMachineOperationPresenter.present({ operation });
      })
  }
);
