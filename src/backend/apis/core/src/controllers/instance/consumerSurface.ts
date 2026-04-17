import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerSurfaceService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { consumerSurfacePresenter } from '../../presenters';

export let consumerSurfaceGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.consumerSurfaceId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerSurfaceId is required',
        description: 'The consumerSurfaceId path parameter is required.'
      })
    );
  }

  let consumerSurface = await consumerSurfaceService.getConsumerSurfaceById({
    instance: ctx.instance,
    consumerSurfaceId: ctx.params.consumerSurfaceId
  });

  return { consumerSurface };
});

export let consumerSurfaceController = Controller.create(
  {
    name: 'Consumer Surfaces',
    description: 'List and retrieve consumer surfaces for an instance.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('consumer-surfaces', 'consumerSurfaces.list'), {
        name: 'List consumer surfaces',
        description: 'Returns a paginated list of consumer surfaces for an instance.',
        hideInDocs: true
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['paid-identity']))
      .outputList(consumerSurfacePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await consumerSurfaceService.listConsumerSurfaces({
          instance: ctx.instance
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerSurface =>
          consumerSurfacePresenter.present({ consumerSurface })
        );
      }),

    get: consumerSurfaceGroup
      .get(instancePath('consumer-surfaces/:consumerSurfaceId', 'consumerSurfaces.get'), {
        name: 'Get consumer surface',
        description: 'Retrieves a consumer surface by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(hasFlags(['paid-identity']))
      .output(consumerSurfacePresenter)
      .do(async ctx =>
        consumerSurfacePresenter.present({ consumerSurface: ctx.consumerSurface })
      )
  }
);
