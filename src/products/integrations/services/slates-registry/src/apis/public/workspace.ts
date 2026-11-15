import { createHono } from '@lowerdeck/hono';
import { Paginator } from '@lowerdeck/pagination';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { useValidation } from '../../lib/validator';
import { workspacePresenter } from '../../presenters';
import { workspaceService } from '../../services';

export let workspacesController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await workspaceService.listWorkspaces({});
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, workspacePresenter));
  })
  .get(':workspaceId', async c => {
    let workspace = await workspaceService.getWorkspaceById({
      id: c.req.param('workspaceId')
    });

    return c.json(await workspacePresenter(workspace));
  });
