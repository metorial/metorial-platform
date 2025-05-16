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
    name: 'Server Category',
    description: 'Read and write server version information'
  },
  {
    list: apiGroup
      .get(Path('server-listing-categories', 'servers.listings.categories.list'), {
        name: 'List server versions',
        description: 'List all server versions'
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
          name: 'Get server version',
          description: 'Get the information of a specific server version'
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
