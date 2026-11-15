import { createHono } from '@lowerdeck/hono';
import { Paginator } from '@lowerdeck/pagination';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { useValidation } from '../../lib/validator';
import { userPresenter } from '../../presenters';
import { userService } from '../../services';

export let usersController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await userService.listUsers({});
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, userPresenter));
  })
  .get(':userId', async c => {
    let user = await userService.getUserById({
      id: c.req.param('userId')
    });

    return c.json(await userPresenter(user));
  });
