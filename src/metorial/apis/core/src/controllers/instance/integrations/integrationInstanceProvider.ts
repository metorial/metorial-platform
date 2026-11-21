import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationInstanceProviderService,
  integrationInstanceService
} from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationInstanceProviderPresenter } from '@metorial/presenters';
import { normalizeToolFilters, toolFiltersValidator } from '../sessions/_shared';
import { getOwnershipActor } from '../../../lib/ownershipActor';

let integrationInstanceProviderGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceProviderId is required',
        description: 'The integrationInstanceProviderId path parameter is required.'
      })
    );
  }

  let integrationInstanceProvider =
    await integrationInstanceProviderService.getIntegrationInstanceProviderById({
      instance: ctx.instance,
      integrationInstanceProviderId: ctx.params.integrationInstanceProviderId,
      allowDeleted: true
    });

  return { integrationInstanceProvider };
});

let integrationInstanceGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceId is required',
        description: 'The integrationInstanceId path parameter is required.'
      })
    );
  }

  let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
    instance: ctx.instance,
    integrationInstanceId: ctx.params.integrationInstanceId,
    allowDeleted: true
  });

  return { integrationInstance };
});

export let integrationInstanceProviderController = Controller.create(
  {
    name: 'Integration Instance Providers',
    description:
      'An integration instance provider binds one provider of an integration instance to the deployment, config, credentials, and tool filters it runs with.'
  },
  {
    list: integrationsGroup
      .get(
        instancePath(
          'integration-instance-providers',
          'integrations.instances.providers.list'
        ),
        {
          name: 'List integration instance providers',
          description: 'Returns a paginated list of integration instance providers.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationInstanceProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), {
              description: 'Search integration instance providers by name, description, or ID.'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description:
                  'Only return integration instance providers with one of these statuses. `deleted` providers are never listed.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instance providers with one of these IDs.'
            }),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers for one of these integrations.'
            }),
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers for one of these integration instances.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers using one of these providers.'
            }),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers using one of these integration providers.'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers running on one of these deployments.'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers using one of these configs.'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers using one of these credentials.'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instance providers using one of these session templates.'
            }),
            created_at: dateFilterValidator('integration instance provider creation time'),
            updated_at: dateFilterValidator('integration instance provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator =
          await integrationInstanceProviderService.listIntegrationInstanceProviders({
            instance: ctx.instance,
            search: ctx.query.search,
            allowDeleted: false,
            status: normalizeArrayParam(ctx.query.status),
            ids: normalizeArrayParam(ctx.query.id),
            integrationIds: normalizeArrayParam(ctx.query.integration_id),
            integrationInstanceIds: normalizeArrayParam(ctx.query.integration_instance_id),
            providerIds: normalizeArrayParam(ctx.query.provider_id),
            integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
            providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
            providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
            providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
            sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
            createdAt: ctx.query.created_at,
            updatedAt: ctx.query.updated_at
          });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, integrationInstanceProvider =>
          integrationInstanceProviderPresenter.present({ integrationInstanceProvider })
        );
      }),

    get: integrationInstanceProviderGroup
      .get(
        instancePath(
          'integration-instance-providers/:integrationInstanceProviderId',
          'integrations.instances.providers.get'
        ),
        {
          name: 'Get integration instance provider',
          description: 'Retrieves an integration instance provider.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationInstanceProviderPresenter)
      .do(async ctx =>
        integrationInstanceProviderPresenter.present({
          integrationInstanceProvider: ctx.integrationInstanceProvider
        })
      ),

    set: integrationInstanceGroup
      .put(
        instancePath(
          'integration-instances/:integrationInstanceId/providers/:providerId',
          'integrations.instances.providers.set'
        ),
        {
          name: 'Set integration instance provider',
          description:
            'Sets the deployment, config, credentials, and tool filters one provider of an integration instance runs with. Creates the entry when none exists, otherwise updates it.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          provider_deployment_id: v.optional(
            v.string({
              description:
                'Deployment to run with. Omitted uses the integration provider’s deployment.'
            })
          ),
          provider_config_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Provider config to run with. Omitted keeps the current one, or the shared config when none exists.'
              })
            )
          ),
          provider_auth_config_id: v.optional(
            v.nullable(
              v.string({
                description: 'Credentials to run with. Omitted keeps the current ones.'
              })
            )
          ),
          tool_filters: toolFiltersValidator,
          is_override_tool_filter: v.optional(
            v.boolean({
              description:
                'Replaces the integration tool filters instead of combining with them.'
            })
          )
        })
      )
      .output(integrationInstanceProviderPresenter)
      .do(async ctx => {
        if (!ctx.params.providerId) {
          throw new ServiceError(
            badRequestError({
              message: 'providerId is required',
              description: 'The providerId path parameter is required.'
            })
          );
        }

        let integrationInstanceProvider =
          await integrationInstanceProviderService.setIntegrationInstanceProvider({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            organizationActor: getOwnershipActor(ctx),
            integrationInstance: ctx.integrationInstance,
            input: {
              providerId: ctx.params.providerId,
              providerDeploymentId: ctx.body.provider_deployment_id,
              providerConfigId: ctx.body.provider_config_id,
              providerAuthConfigId: ctx.body.provider_auth_config_id ?? undefined,
              toolFilters:
                ctx.body.tool_filters === undefined
                  ? undefined
                  : normalizeToolFilters(ctx.body.tool_filters),
              isOverrideToolFilter: ctx.body.is_override_tool_filter
            }
          });

        return integrationInstanceProviderPresenter.present({ integrationInstanceProvider });
      })
  }
);
