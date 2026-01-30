import { badRequestError, ServiceError } from '@metorial/error';
import { subspacePublisherService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerInstanceGroup, providerPath } from '../../middleware/providerGroup';
import { publisherPresenter } from '../../presenters';
import { SubspacePublisher } from '../../presenters/types';

export let providerPublisherGroup = providerInstanceGroup.use(async ctx => {
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

export let providerPublisherController = Controller.create(
  {
    name: 'Publishers',
    description:
      'A publisher is the organization or individual who created and maintains a provider.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('publishers', 'publishers.list'), {
        name: 'List publishers',
        description: 'Returns a paginated list of publishers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(publisherPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspacePublisherService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, publisher =>
          publisherPresenter.present({ publisher: publisher as SubspacePublisher })
        );
      }),

    get: providerPublisherGroup
      .get(providerPath('publishers/:publisherId', 'publishers.get'), {
        name: 'Get publisher',
        description: 'Retrieves a specific publisher by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(publisherPresenter)
      .do(async ctx => {
        return publisherPresenter.present({ publisher: ctx.publisher });
      })
  }
);
