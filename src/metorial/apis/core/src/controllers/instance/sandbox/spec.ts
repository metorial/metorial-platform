import { Paginator } from '@lowerdeck/pagination';
import { sandboxSpecService } from '@metorial/module-sandbox';
import { sandboxSpecPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxInstanceGroup, sandboxReadScopes } from './_middleware';

export let sandboxSpecController = Controller.create(
  {
    name: 'Sandbox specs',
    description: 'The CPU and memory sizes sandbox machines can be created with.'
  },
  {
    list: sandboxInstanceGroup
      .get(instancePath('sandbox/specs', 'sandbox.specs.list'), {
        name: 'List sandbox specs',
        description: 'Returns a paginated list of available machine specs.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxSpecPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await sandboxSpecService.list();
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, spec => sandboxSpecPresenter.present({ spec }));
      }),

    get: sandboxInstanceGroup
      .get(instancePath('sandbox/specs/:specId', 'sandbox.specs.get'), {
        name: 'Get sandbox spec',
        description: 'Retrieves a machine spec by ID.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxSpecPresenter)
      .do(async ctx => {
        let spec = await sandboxSpecService.get({
          specId: requirePathParam(ctx.params, 'specId')
        });

        return sandboxSpecPresenter.present({ spec });
      })
  }
);
