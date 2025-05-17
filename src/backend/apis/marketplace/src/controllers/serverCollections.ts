import { createHono } from '@metorial/hono';
import { serverListingCollectionService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { serverCollectionPresenter } from '../presenters/serverCollection';

export let serverCollectionsController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.query();

    let paginator = await serverListingCollectionService.listServerListingCollections({});
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, serverCollectionPresenter));
  })
  .get(':collectionId', async c => {
    let collection = await serverListingCollectionService.getServerListingCollectionById({
      serverListingCollectionId: c.req.param('collectionId')
    });

    return c.json(await serverCollectionPresenter(collection));
  });
