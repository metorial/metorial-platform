import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  subspaceIntegrationInstanceProviderService,
  subspaceIntegrationInstanceService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { integrationInstanceProviderPresenter } from '../../presenters';
import { toolFiltersValidator } from './session';

let integrationInstanceProviderGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceProviderId is required',
        description: 'The integrationInstanceProviderId path parameter is required.'
      })
    );
  }

  let integrationInstanceProvider = await subspaceIntegrationInstanceProviderService.get({
    instance: ctx.instance,
    integrationInstanceProviderId: ctx.params.integrationInstanceProviderId,
    allowDeleted: true
  });

  return { integrationInstanceProvider };
});

let integrationInstanceGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceId is required',
        description: 'The integrationInstanceId path parameter is required.'
      })
    );
  }

  let integrationInstance = await subspaceIntegrationInstanceService.get({
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
      'Integration instance providers resolve the effective per-instance provider materialization for an integration.'
  },
  {
    list: instanceGroup
      .get(
        instancePath('integration-instance-providers', 'integrationInstanceProviders.list'),
        {
          name: 'List integration instance providers',
          description: 'Returns a paginated list of integration instance providers.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationInstanceProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('integration instance provider creation time'),
            updated_at: dateFilterValidator('integration instance provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIntegrationInstanceProviderService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: true,
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
          'integrationInstanceProviders.get'
        ),
        {
          name: 'Get integration instance provider',
          description: 'Retrieves a specific integration instance provider.'
        }
      )
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
          'integrationInstanceProviders.set'
        ),
        {
          name: 'Set integration instance provider',
          description:
            'Creates or updates the effective integration instance provider materialization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          provider_deployment_id: v.optional(v.string()),
          provider_config_id: v.optional(v.nullable(v.string())),
          provider_auth_config_id: v.optional(v.nullable(v.string())),
          tool_filters: toolFiltersValidator,
          is_override_tool_filter: v.optional(v.boolean())
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

        let integrationInstanceProvider = await subspaceIntegrationInstanceProviderService.set(
          {
            instance: ctx.instance,
            integrationInstanceId: ctx.integrationInstance.id,
            providerId: ctx.params.providerId,
            providerDeploymentId: ctx.body.provider_deployment_id,
            providerConfigId: ctx.body.provider_config_id,
            providerAuthConfigId: ctx.body.provider_auth_config_id ?? undefined,
            toolFilters: ctx.body.tool_filters,
            isOverrideToolFilter: ctx.body.is_override_tool_filter
          } as any
        );

        return integrationInstanceProviderPresenter.present({ integrationInstanceProvider });
      }),

    delete: integrationInstanceProviderGroup
      .delete(
        instancePath(
          'integration-instance-providers/:integrationInstanceProviderId',
          'integrationInstanceProviders.delete'
        ),
        {
          name: 'Delete integration instance provider',
          description: 'Archives a specific integration instance provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationInstanceProviderPresenter)
      .do(async ctx => {
        let integrationInstanceProvider =
          await subspaceIntegrationInstanceProviderService.delete({
            instance: ctx.instance,
            integrationInstanceProviderId: ctx.integrationInstanceProvider.id,
            allowDeleted: true
          });

        return integrationInstanceProviderPresenter.present({ integrationInstanceProvider });
      })
  }
);
