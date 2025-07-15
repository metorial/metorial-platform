import { serverListingCategoryService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { apiGroup } from '../../middleware/apiGroup';
import { checkAccess } from '../../middleware/checkAccess';
import { serverListingCategoryPresenter } from '../../presenters';

export let serverListingCategoryGroup = apiGroup.use(async ctx => {
  if (!ctx.params.serverListingCategoryId)
    throw new Error('serverListingCategoryId is required');

  let serverListingCategory = await serverListingCategoryService.getServerListingCategoryById({
    serverListingCategoryId: ctx.params.serverListingCategoryId
  });

  return { serverListingCategory };
});

export let serverListingCategoryController = Controller.create(
  {
    name: 'ServerListingCategory',
    description:
      'Provides access to server listing categories, used for organizing and filtering server listings.'
  },
  {
    list: apiGroup
      .get(Path('server-listing-categories', 'servers.listings.categories.list'), {
        name: 'List server listing categories',
        description: 'Returns a list of all available server listing categories.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .outputList(serverListingCategoryPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await serverListingCategoryService.listServerListingCategories({});
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, category =>
          serverListingCategoryPresenter.present({ category })
        );
      }),

    get: serverListingCategoryGroup
      .get(
        Path(
          'server-listing-categories/:serverListingCategoryId',
          'servers.listings.categories.get'
        ),
        {
          name: 'Get server listing category',
          description: 'Returns information for a specific server listing category.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverListingCategoryPresenter)
      .do(async ctx => {
        return serverListingCategoryPresenter.present({
          category: ctx.serverListingCategory
        });
      })
  }
);
