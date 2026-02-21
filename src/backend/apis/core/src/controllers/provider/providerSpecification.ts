import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderSpecificationService,
  type SubspaceProviderSpecification
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerSpecificationPresenter } from '../../presenters';

export let providerSpecificationGroup = instanceGroup.use(async ctx => {
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
    list: instanceGroup
      .get(instancePath('provider-specifications', 'providers.specifications.list'), {
        name: 'List provider specifications',
        description: 'Returns a paginated list of provider specifications.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerSpecificationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider version ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID(s)'
            })

            //             ids: string[] | undefined;
            // providerIds: string[] | undefined;
            // providerVersionIds: string[] | undefined;
            // providerDeploymentIds: string[] | undefined;
            // providerConfigIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderSpecificationService.list({
          instance: ctx.instance,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerVersionIds: normalizeArrayParam(ctx.query.provider_version_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, specification =>
          providerSpecificationPresenter.present({ specification })
        );
      }),

    get: providerSpecificationGroup
      .get(
        instancePath(
          'provider-specifications/:providerSpecificationId',
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
          specification: ctx.specification as unknown as SubspaceProviderSpecification
        });
      })
  }
);
