import { Paginator } from '@lowerdeck/pagination';
import { sandboxRegionService } from '@metorial/module-sandbox';
import { sandboxRegionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxInstanceGroup, sandboxReadScopes } from './_middleware';

export let sandboxRegionController = Controller.create(
  {
    name: 'Sandbox regions',
    description: 'Regions in which sandbox machines, disks, and images are available.'
  },
  {
    list: sandboxInstanceGroup
      .get(instancePath('sandbox/regions', 'sandbox.regions.list'), {
        name: 'List sandbox regions',
        description: 'Returns a paginated list of regions sandboxes can run in.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxRegionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await sandboxRegionService.list();
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, region => sandboxRegionPresenter.present({ region }));
      }),

    get: sandboxInstanceGroup
      .get(instancePath('sandbox/regions/:regionId', 'sandbox.regions.get'), {
        name: 'Get sandbox region',
        description: 'Retrieves a sandbox region by its identifier.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxRegionPresenter)
      .do(async ctx => {
        let region = await sandboxRegionService.get({
          identifier: requirePathParam(ctx.params, 'regionId')
        });

        return sandboxRegionPresenter.present({ region });
      })
  }
);
