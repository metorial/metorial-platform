import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderSpecificationService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { specificationPresenter } from '../../presenters';
import { SubspaceSpecification } from '../../presenters/types';

export let providerSpecificationGroup = providerInstanceGroup.use(async ctx => {
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
    description: 'Browse provider specifications.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-specifications', 'providerSpecifications.list'), {
        name: 'List provider specifications',
        description: 'Returns a paginated list of provider specifications.'
      })
      .outputList(specificationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderSpecificationService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, specification =>
          specificationPresenter.present({ specification: specification as SubspaceSpecification })
        );
      }),

    get: providerSpecificationGroup
      .get(providerPath('provider-specifications/:providerSpecificationId', 'providerSpecifications.get'), {
        name: 'Get provider specification',
        description: 'Retrieves a specific provider specification by ID.'
      })
      .output(specificationPresenter)
      .do(async ctx => {
        return specificationPresenter.present({ specification: ctx.specification });
      })
  }
);
