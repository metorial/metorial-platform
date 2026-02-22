import { badRequestError, ServiceError } from '@metorial/error';
import { subspacePublisherService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { publisherPresenter } from '../../presenters';

let publisherGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.publisherId) {
    throw new ServiceError(
      badRequestError({
        message: 'publisherId is required',
        description: 'The publisherId path parameter is required.'
      })
    );
  }

  let publisher = await subspacePublisherService.get({
    instance: ctx.instance,
    publisherId: ctx.params.publisherId
  });

  return { publisher };
});

export let publisherController = Controller.create(
  {
    name: 'Publishers',
    description:
      'A publisher is the organization or individual who created and maintains a provider.'
  },
  {
    list: instanceGroup
      .get(instancePath('publishers', 'publishers.list'), {
        name: 'List publishers',
        description: 'Returns a paginated list of publishers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(publisherPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspacePublisherService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, publisher => publisherPresenter.present({ publisher }));
      }),

    get: publisherGroup
      .get(instancePath('publishers/:publisherId', 'publishers.get'), {
        name: 'Get publisher',
        description: 'Retrieves a specific publisher by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(publisherPresenter)
      .do(async ctx => {
        return publisherPresenter.present({ publisher: ctx.publisher });
      })
  }
);
