import { createHono } from '@metorial/hono';
import { subspacePublicProviderListingCollectionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { toPaginationQuery } from '../lib/paginationQuery';
import { paginatorSchema } from '../lib/paginatorSchema';
import { presentProviderCollection } from '../presenters/provider';
import { useValidation } from '../lib/validator';

export let providerCollectionsController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await subspacePublicProviderListingCollectionService.list({});
    let list = await paginator.run(toPaginationQuery(query));

    return c.json(
      await Paginator.presentLight(list, collection => presentProviderCollection(collection))
    );
  })
  .get(':collectionId', async c => {
    let collection = await subspacePublicProviderListingCollectionService.get({
      providerListingCollectionId: c.req.param('collectionId')
    });

    return c.json(presentProviderCollection(collection));
  });
