import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderSpecificationService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerSpecificationPresenter } from '../../presenters';

import { providerGroup } from './provider';

export let providerSpecificationGroup = providerGroup.use(async ctx => {
  if (!ctx.params.providerSpecificationId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerSpecificationId is required',
        description: 'The providerSpecificationId path parameter is required.'
      })
    );
  }

  let specification = await subspaceProviderSpecificationService.get({
    instance: ctx.instance,
    providerSpecificationId: ctx.params.providerSpecificationId
  });

  return { specification };
});

export let providerSpecificationController = Controller.create(
  {
    name: 'Provider Specifications',
    description:
      'A specification defines what a provider version can do: its tools, auth methods, and required configuration fields.'
  },
  {
    list: providerGroup
      .get(
        instancePath('providers/:providerId/specifications', 'providers.specifications.list'),
        {
          name: 'List provider specifications',
          description: 'Returns a paginated list of provider specifications.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerSpecificationPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderSpecificationService.list({
          instance: ctx.instance,
          providerIds: [ctx.provider.id]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, specification =>
          providerSpecificationPresenter.present({ specification })
        );
      }),

    get: providerSpecificationGroup
      .get(
        instancePath(
          'providers/:providerId/specifications/:providerSpecificationId',
          'providers.specifications.get'
        ),
        {
          name: 'Get provider specification',
          description: 'Retrieves a specific provider specification by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerSpecificationPresenter)
      .do(async ctx => {
        return providerSpecificationPresenter.present({
          specification: ctx.specification as unknown as SubspaceSpecification
        });
      })
  }
);
