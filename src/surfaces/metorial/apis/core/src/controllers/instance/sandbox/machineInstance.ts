import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  sandboxMachineInstanceService,
  type SandboxMachineInstanceFilter
} from '@metorial/module-sandbox';
import {
  sandboxLogLinesPresenter,
  sandboxMachineInstancePresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxReadScopes } from './_middleware';
import { sandboxMachineGroup } from './machine';

let instanceStatuses = [
  'start_requested',
  'start_platform_pending',
  'start_platform_complete',
  'start_initialize_pending',
  'running',
  'pause_requested',
  'pause_prepare_pending',
  'pause_prepare_complete',
  'pause_platform_pending',
  'paused',
  'resume_requested',
  'resume_platform_pending',
  'resume_platform_complete',
  'resume_initialize_pending',
  'terminate_requested',
  'terminate_prepare_pending',
  'terminate_prepare_complete',
  'terminate_platform_pending',
  'terminated',
  'failed'
] as const satisfies readonly NonNullable<SandboxMachineInstanceFilter['statuses']>[number][];

let instanceStatusValidator = v.enumOf([...instanceStatuses]);

export let sandboxMachineInstanceController = Controller.create(
  {
    name: 'Sandbox machine instances',
    description:
      'Instances are the concrete virtual machines a sandbox machine runs on over its lifetime.'
  },
  {
    list: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/instances',
          'sandbox.machines.instances.list'
        ),
        {
          name: 'List machine instances',
          description: 'Returns a paginated list of the instances of a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxMachineInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([instanceStatusValidator, v.array(instanceStatusValidator)]),
              { description: 'Filter by instance status' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxMachineInstanceService.list({
          machine: ctx.machine,
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, instance =>
          sandboxMachineInstancePresenter.present({ machine: ctx.machine, instance })
        );
      }),

    get: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/instances/:machineInstanceId',
          'sandbox.machines.instances.get'
        ),
        {
          name: 'Get machine instance',
          description: 'Retrieves an instance of a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxMachineInstancePresenter)
      .do(async ctx => {
        let instance = await sandboxMachineInstanceService.get({
          machine: ctx.machine,
          instanceId: requirePathParam(ctx.params, 'machineInstanceId')
        });

        return sandboxMachineInstancePresenter.present({ machine: ctx.machine, instance });
      }),

    logs: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/instances/:machineInstanceId/logs',
          'sandbox.machines.instances.logs'
        ),
        {
          name: 'Get machine instance logs',
          description: 'Returns a page of the console output of an instance.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .query(
        'default',
        v.object({
          direction: v.optional(v.enumOf(['forward', 'backward']), {
            description: 'Whether to read from the cursor toward newer or older lines'
          }),
          cursor: v.optional(v.number(), { description: 'The line index to start from' }),
          limit: v.optional(v.number({ modifiers: [v.minValue(1), v.maxValue(1000)] }), {
            description: 'The maximum number of lines to return'
          })
        })
      )
      .output(sandboxLogLinesPresenter)
      .do(async ctx => {
        let logs = await sandboxMachineInstanceService.logs({
          machine: ctx.machine,
          instanceId: requirePathParam(ctx.params, 'machineInstanceId'),
          input: ctx.query
        });

        return sandboxLogLinesPresenter.present({ logs });
      })
  }
);
