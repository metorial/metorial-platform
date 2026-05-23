import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import {
  subspaceIntegrationInstanceGroupProviderService,
  subspaceIntegrationInstanceGroupService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationInstanceGroupProviderPresenter } from '../../../presenters';
import { toolFiltersValidator } from '../sessions/_shared';

let integrationInstanceGroupProviderGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceGroupProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceGroupProviderId is required',
        description: 'The integrationInstanceGroupProviderId path parameter is required.'
      })
    );
  }

  let integrationInstanceGroupProvider =
    await subspaceIntegrationInstanceGroupProviderService.get({
      instance: ctx.instance,
      integrationInstanceGroupProviderId: ctx.params.integrationInstanceGroupProviderId,
      allowDeleted: true
    });

  return { integrationInstanceGroupProvider };
});

let integrationInstanceGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceGroupId is required',
        description: 'The integrationInstanceGroupId path parameter is required.'
      })
    );
  }

  let integrationInstanceGroup = await subspaceIntegrationInstanceGroupService.get({
    instance: ctx.instance,
    integrationInstanceGroupId: ctx.params.integrationInstanceGroupId,
    allowDeleted: true
  });

  return { integrationInstanceGroup };
});

export let integrationInstanceGroupProviderController = Controller.create(
  {
    name: 'Integration Instance Group Providers',
    description:
      'Integration instance group providers define the effective routed provider set for an integration instance group.'
  },
  {
    list: instanceGroup
      .get(
        instancePath(
          'integration-instance-group-providers',
          'integrations.instanceGroups.providers.list'
        ),
        {
          name: 'List integration instance group providers',
          description: 'Returns a paginated list of integration instance group providers.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationInstanceGroupProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_instance_group_id: v.optional(
              v.union([v.string(), v.array(v.string())])
            ),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_instance_provider_id: v.optional(
              v.union([v.string(), v.array(v.string())])
            ),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator(
              'integration instance group provider creation time'
            ),
            updated_at: dateFilterValidator(
              'integration instance group provider last update time'
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIntegrationInstanceGroupProviderService.list({
          instance: ctx.instance,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          integrationInstanceGroupIds: normalizeArrayParam(
            ctx.query.integration_instance_group_id
          ),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationInstanceIds: normalizeArrayParam(ctx.query.integration_instance_id),
          integrationInstanceProviderIds: normalizeArrayParam(
            ctx.query.integration_instance_provider_id
          ),
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

        return Paginator.present(list, integrationInstanceGroupProvider =>
          integrationInstanceGroupProviderPresenter.present({
            integrationInstanceGroupProvider
          })
        );
      }),

    get: integrationInstanceGroupProviderGroup
      .get(
        instancePath(
          'integration-instance-group-providers/:integrationInstanceGroupProviderId',
          'integrations.instanceGroups.providers.get'
        ),
        {
          name: 'Get integration instance group provider',
          description: 'Retrieves a specific integration instance group provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationInstanceGroupProviderPresenter)
      .do(async ctx =>
        integrationInstanceGroupProviderPresenter.present({
          integrationInstanceGroupProvider: ctx.integrationInstanceGroupProvider
        })
      ),

    set: integrationInstanceGroupGroup
      .put(
        instancePath(
          'integration-instance-groups/:integrationInstanceGroupId/providers/:integrationInstanceProviderId',
          'integrations.instanceGroups.providers.set'
        ),
        {
          name: 'Set integration instance group provider',
          description:
            'Creates or updates the effective integration instance group provider materialization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          tool_filters: toolFiltersValidator
        })
      )
      .output(integrationInstanceGroupProviderPresenter)
      .do(async ctx => {
        if (!ctx.params.integrationInstanceProviderId) {
          throw new ServiceError(
            badRequestError({
              message: 'integrationInstanceProviderId is required',
              description: 'The integrationInstanceProviderId path parameter is required.'
            })
          );
        }

        let integrationInstanceGroupProvider =
          await subspaceIntegrationInstanceGroupProviderService.set({
            instance: ctx.instance,
            integrationInstanceGroupId: ctx.integrationInstanceGroup.id,
            integrationInstanceProviderId: ctx.params.integrationInstanceProviderId,
            toolFilters: ctx.body.tool_filters
          });

        return integrationInstanceGroupProviderPresenter.present({
          integrationInstanceGroupProvider
        });
      }),

    delete: integrationInstanceGroupProviderGroup
      .delete(
        instancePath(
          'integration-instance-group-providers/:integrationInstanceGroupProviderId',
          'integrations.instanceGroups.providers.delete'
        ),
        {
          name: 'Delete integration instance group provider',
          description: 'Archives a specific integration instance group provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationInstanceGroupProviderPresenter)
      .do(async ctx => {
        let integrationInstanceGroupProvider =
          await subspaceIntegrationInstanceGroupProviderService.delete({
            instance: ctx.instance,
            integrationInstanceGroupProviderId: ctx.integrationInstanceGroupProvider.id,
            allowDeleted: true
          });

        return integrationInstanceGroupProviderPresenter.present({
          integrationInstanceGroupProvider
        });
      })
  }
);
