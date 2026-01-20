import { createHono } from '@metorial/hono';
import { subspaceCollectionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { collectionPresenter } from '../presenters';

export let collectionsController = createHono()
  .get(
    '',
    useValidation('query', paginatorSchema),
    async c => {
      let query = c.req.query();

      let paginator = await subspaceCollectionService.list({});

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, collectionPresenter));
    }
  )
  .get(':providerCollectionId', async c => {
    let providerCollectionId = c.req.param('providerCollectionId');

    let collection = await subspaceCollectionService.get({ providerCollectionId });

    return c.json(collectionPresenter(collection));
  });
