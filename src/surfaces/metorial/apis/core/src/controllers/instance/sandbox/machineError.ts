import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sandboxMachineErrorService } from '@metorial/module-sandbox';
import { sandboxMachineErrorPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxReadScopes } from './_middleware';
import { sandboxMachineGroup } from './machine';

export let sandboxMachineErrorController = Controller.create(
  {
    name: 'Sandbox machine errors',
    description:
      'Errors reported from inside a machine, such as a failing lifecycle hook or setup command.'
  },
  {
    list: sandboxMachineGroup
      .get(
        instancePath('sandbox/machines/:machineId/errors', 'sandbox.machines.errors.list'),
        {
          name: 'List machine errors',
          description: 'Returns a paginated list of the errors reported by a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxMachineErrorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            machine_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only errors of these instances'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxMachineErrorService.list({
          machine: ctx.machine,
          instanceIds: normalizeArrayParam(ctx.query.machine_instance_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, error =>
          sandboxMachineErrorPresenter.present({ error })
        );
      }),

    get: sandboxMachineGroup
      .get(
        instancePath(
          'sandbox/machines/:machineId/errors/:errorId',
          'sandbox.machines.errors.get'
        ),
        {
          name: 'Get machine error',
          description: 'Retrieves an error reported by a machine.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxMachineErrorPresenter)
      .do(async ctx => {
        let error = await sandboxMachineErrorService.get({
          machine: ctx.machine,
          errorId: requirePathParam(ctx.params, 'errorId')
        });

        return sandboxMachineErrorPresenter.present({ error });
      })
  }
);
