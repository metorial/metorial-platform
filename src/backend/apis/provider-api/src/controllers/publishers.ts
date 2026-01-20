import { createHono } from '@metorial/hono';
import { subspacePublisherService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../lib/paginatorSchema';
import { useValidation } from '../lib/validator';
import { publisherPresenter } from '../presenters';

export let publishersController = createHono()
  .get(
    '',
    useValidation('query', paginatorSchema),
    async c => {
      let query = c.req.query();

      let paginator = await subspacePublisherService.list({});

      let list = await paginator.run(query);

      return c.json(await Paginator.presentLight(list, publisherPresenter));
    }
  )
  .get(':publisherId', async c => {
    let publisherId = c.req.param('publisherId');

    let publisher = await subspacePublisherService.get({ publisherId });

    return c.json(publisherPresenter(publisher));
  });
