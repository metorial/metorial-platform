import { createHono } from '@metorial/hono';
import {
  subspacePublicProviderListingCollectionService,
  type SubspaceProviderListingCollection
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { providerCollectionPresenter } from '../../../core/src/presenters';
import { toPaginationQuery } from '../lib/paginationQuery';
import { runMarketplacePresenter } from '../lib/presenter';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';

let presentProviderCollection = async (collection: SubspaceProviderListingCollection) =>
  await runMarketplacePresenter(providerCollectionPresenter.present({ collection }));

export let serverCollectionsController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let query = c.req.valid('query');

    let paginator = await subspacePublicProviderListingCollectionService.list({});
    let list = await paginator.run(toPaginationQuery(query));

    return c.json(await Paginator.presentLight(list, presentProviderCollection));
  })
  .get(':collectionId', async c => {
    let collection = await subspacePublicProviderListingCollectionService.get({
      providerListingCollectionId: c.req.param('collectionId')
    });

    return c.json(await presentProviderCollection(collection));
  });
