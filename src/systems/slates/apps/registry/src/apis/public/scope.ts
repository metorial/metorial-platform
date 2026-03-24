import { createHono } from '@lowerdeck/hono';
import { Paginator } from '@lowerdeck/pagination';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { useValidation } from '../../lib/validator';
import { scopePresenter } from '../../presenters';
import { scopeService } from '../../services';

export let scopesController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await scopeService.listScopes({});
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, scopePresenter));
  })
  .get(':scopeId', async c => {
    let scope = await scopeService.getScopeById({
      id: c.req.param('scopeId')
    });

    return c.json(await scopePresenter(scope));
  });
