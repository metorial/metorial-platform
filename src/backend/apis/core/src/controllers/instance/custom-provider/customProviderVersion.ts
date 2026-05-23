import { badRequestError, paymentRequiredError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { flagService } from '@metorial/module-flags';
import { subspaceCustomProviderVersionService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { subspaceCustomProviderVersionPresenter } from '../../../presenters';
import {
  customProviderConfigValidator,
  customProviderFromValidator,
  mapCustomProviderFrom
} from './customProvider';

let customProviderVersionGroup = instanceGroup.use(async ctx => {
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
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.version:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
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
              { description: 'Filter by deployment status' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider IDs (matches providers connected to sessions)'
            }),
            provider_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Filter by provider version IDs (matches providers connected to sessions)'
            }),
            custom_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Filter by custom provider IDs (matches providers connected to sessions)'
            }),
            custom_provider_deployment_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description:
                  'Filter by custom provider deployment IDs (matches providers connected to sessions)'
              }
            ),
            custom_provider_environment_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description:
                  'Filter by custom provider environment IDs (matches providers connected to sessions)'
              }
            ),
            created_at: dateFilterValidator('custom provider version creation time'),
            updated_at: dateFilterValidator('custom provider version last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCustomProviderVersionService.list({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerVersionIds: normalizeArrayParam(ctx.query.provider_version_id),
          customProviderIds: normalizeArrayParam(ctx.query.custom_provider_id),
          customProviderDeploymentIds: normalizeArrayParam(
            ctx.query.custom_provider_deployment_id
          ),
          customProviderEnvironmentIds: normalizeArrayParam(
            ctx.query.custom_provider_environment_id
          ),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderVersion =>
          subspaceCustomProviderVersionPresenter.present({
            customProviderVersion
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
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.version:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderVersionPresenter)
      .do(async ctx => {
        return subspaceCustomProviderVersionPresenter.present({
          customProviderVersion: ctx.customProviderVersion
        });
      }),

    create: instanceGroup
      .post(instancePath('custom-provider-versions', 'customProviders.versions.create'), {
        name: 'Create custom provider version',
        description: 'Creates a new version for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.version:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
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
        if (ctx.body.from.type === 'container') {
          let flags = await flagService.getFlags({ organization: ctx.organization });
          if (!flags['paid-custom-docker-providers']) {
            throw new ServiceError(
              paymentRequiredError({
                message: 'Please upgrade to a different plan to access this feature'
              })
            );
          }
        }

        let customProviderVersion = await subspaceCustomProviderVersionService.create({
          instance: ctx.instance,
          organizationActor: ctx.actor!,
          customProviderId: ctx.body.custom_provider_id,
          from: mapCustomProviderFrom(ctx.body.from),
          config: ctx.body.config
        });

        return subspaceCustomProviderVersionPresenter.present({
          customProviderVersion
        });
      })
  }
);
