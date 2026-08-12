import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { publisherService } from '@metorial-subspace/module-catalog';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { publisherPresenter } from '@metorial/presenters';

let publisherGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.publisherId) {
    throw new ServiceError(
      badRequestError({
        message: 'publisherId is required',
        description: 'The publisherId path parameter is required.'
      })
    );
  }

  let publisher = await publisherService.getPublisherById({
    instance: ctx.instance,
    publisherId: ctx.params.publisherId
  });

  return { publisher };
});

export let publisherController = Controller.create(
  {
    name: 'Publishers',
    description:
      'A publisher is the organization or individual who created and maintains a provider.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('publishers', 'publishers.list'), {
        name: 'List publishers',
        description: 'Returns a paginated list of publishers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.publisher:read'] }))
      .outputList(publisherPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await publisherService.listPublishers({
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
      .use(checkAccess({ possibleScopes: ['instance.provider.publisher:read'] }))
      .output(publisherPresenter)
      .do(async ctx => {
        return publisherPresenter.present({ publisher: ctx.publisher });
      })
  }
);
