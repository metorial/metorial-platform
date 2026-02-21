import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceCustomProviderVersionService,
  type SubspaceCustomProviderVersion
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderVersionPresenter } from '../../presenters';
import {
  customProviderConfigValidator,
  customProviderFromValidator,
  mapCustomProviderFrom
} from './customProvider';

export let customProviderVersionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderVersionId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderVersionId is required',
        description: 'The customProviderVersionId path parameter is required.'
      })
    );
  }

  let customProviderVersion = await subspaceCustomProviderVersionService.get({
    instance: ctx.instance,
    customProviderVersionId: ctx.params.customProviderVersionId
  });

  return { customProviderVersion };
});

export let customProviderVersionController = Controller.create(
  {
    name: 'Custom Provider Versions',
    description:
      'Versions represent different releases of a custom provider. Each version can be deployed to environments.'
  },
  {
    list: instanceGroup
      .get(instancePath('custom-provider-versions', 'customProviders.versions.list'), {
        name: 'List custom provider versions',
        description: 'Returns a paginated list of versions for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(subspaceCustomProviderVersionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['queued', 'deploying', 'deployment_succeeded', 'deployment_failed']),
                v.array(
                  v.enumOf([
                    'queued',
                    'deploying',
                    'deployment_succeeded',
                    'deployment_failed'
                  ])
                )
              ]),
              {
                description:
                  'Filter by status (queued, deploying, deployment_succeeded, deployment_failed)'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version IDs'
            }),
            custom_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            })

            //         status: ("queued" | "deploying" | "deployment_succeeded" | "deployment_failed")[] | undefined;
            // ids: string[] | undefined;
            // providerIds: string[] | undefined;
            // providerVersionIds: string[] | undefined;
            // customProviderIds: string[] | undefined;
            // customProviderDeploymentIds: string[] | undefined;
            // customProviderEnvironmentIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCustomProviderVersionService.list({
          instance: ctx.instance,
          customProviderIds: normalizeArrayParam(ctx.query.custom_provider_id),
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderVersion =>
          subspaceCustomProviderVersionPresenter.present({
            customProviderVersion: customProviderVersion as SubspaceCustomProviderVersion
          })
        );
      }),

    get: customProviderVersionGroup
      .get(
        instancePath(
          'custom-provider-versions/:customProviderVersionId',
          'customProviders.versions.get'
        ),
        {
          name: 'Get custom provider version',
          description: 'Retrieves a specific version of a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(subspaceCustomProviderVersionPresenter)
      .do(async ctx => {
        return subspaceCustomProviderVersionPresenter.present({
          customProviderVersion: ctx.customProviderVersion as SubspaceCustomProviderVersion
        });
      }),

    create: instanceGroup
      .post(instancePath('custom-provider-versions', 'customProviders.versions.create'), {
        name: 'Create custom provider version',
        description: 'Creates a new version for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          custom_provider_id: v.string({
            description: 'Custom provider ID',
            examples: ['cp_1aBcDeFgHjKlMnPq']
          }),
          from: customProviderFromValidator,
          config: customProviderConfigValidator
        })
      )
      .output(subspaceCustomProviderVersionPresenter)
      .do(async ctx => {
        let customProviderVersion = await subspaceCustomProviderVersionService.create({
          instance: ctx.instance,
          organizationActor: ctx.actor,
          customProviderId: ctx.body.custom_provider_id,
          from: mapCustomProviderFrom(ctx.body.from),
          config: ctx.body.config
        });

        return subspaceCustomProviderVersionPresenter.present({
          customProviderVersion: customProviderVersion as SubspaceCustomProviderVersion
        });
      })
  }
);
