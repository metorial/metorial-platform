import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceIntegrationInstanceGroupService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { integrationInstanceGroupPresenter } from '../../presenters';
import { toolFiltersValidator } from './session';

let integrationInstanceGroupProviderInputValidator = v.object({
  integration_instance_provider_id: v.string(),
  tool_filters: toolFiltersValidator
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

export let integrationInstanceGroupController = Controller.create(
  {
    name: 'Integration Instance Groups',
    description:
      'Integration instance groups combine instance providers into a grouped routed configuration.'
  },
  {
    list: instanceGroup
      .get(instancePath('integration-instance-groups', 'integrationInstanceGroups.list'), {
        name: 'List integration instance groups',
        description: 'Returns a paginated list of integration instance groups.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationInstanceGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['draft', 'active', 'archived', 'deleted']),
                v.array(v.enumOf(['draft', 'active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
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
            created_at: dateFilterValidator('integration instance group creation time'),
            updated_at: dateFilterValidator('integration instance group last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIntegrationInstanceGroupService.list({
          instance: ctx.instance,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
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

        return Paginator.present(list, integrationInstanceGroup =>
          integrationInstanceGroupPresenter.present({ integrationInstanceGroup })
        );
      }),

    get: integrationInstanceGroupGroup
      .get(
        instancePath(
          'integration-instance-groups/:integrationInstanceGroupId',
          'integrationInstanceGroups.get'
        ),
        {
          name: 'Get integration instance group',
          description: 'Retrieves a specific integration instance group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationInstanceGroupPresenter)
      .do(async ctx =>
        integrationInstanceGroupPresenter.present({
          integrationInstanceGroup: ctx.integrationInstanceGroup
        })
      ),

    create: instanceGroup
      .post(instancePath('integration-instance-groups', 'integrationInstanceGroups.create'), {
        name: 'Create integration instance group',
        description: 'Creates a new integration instance group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          providers: v.optional(v.array(integrationInstanceGroupProviderInputValidator))
        })
      )
      .output(integrationInstanceGroupPresenter)
      .do(async ctx => {
        let integrationInstanceGroup = await subspaceIntegrationInstanceGroupService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providers: ctx.body.providers?.map(provider => ({
            integrationInstanceProviderId: provider.integration_instance_provider_id,
            toolFilters: provider.tool_filters
          }))
        });

        return integrationInstanceGroupPresenter.present({ integrationInstanceGroup });
      }),

    update: integrationInstanceGroupGroup
      .patch(
        instancePath(
          'integration-instance-groups/:integrationInstanceGroupId',
          'integrationInstanceGroups.update'
        ),
        {
          name: 'Update integration instance group',
          description: 'Updates a specific integration instance group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          providers: v.optional(v.array(integrationInstanceGroupProviderInputValidator))
        })
      )
      .output(integrationInstanceGroupPresenter)
      .do(async ctx => {
        let integrationInstanceGroup = await subspaceIntegrationInstanceGroupService.update({
          instance: ctx.instance,
          integrationInstanceGroupId: ctx.integrationInstanceGroup.id,
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providers: ctx.body.providers?.map(provider => ({
            integrationInstanceProviderId: provider.integration_instance_provider_id,
            toolFilters: provider.tool_filters
          }))
        });

        return integrationInstanceGroupPresenter.present({ integrationInstanceGroup });
      }),

    delete: integrationInstanceGroupGroup
      .delete(
        instancePath(
          'integration-instance-groups/:integrationInstanceGroupId',
          'integrationInstanceGroups.delete'
        ),
        {
          name: 'Delete integration instance group',
          description: 'Archives a specific integration instance group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationInstanceGroupPresenter)
      .do(async ctx => {
        let integrationInstanceGroup = await subspaceIntegrationInstanceGroupService.delete({
          instance: ctx.instance,
          integrationInstanceGroupId: ctx.integrationInstanceGroup.id,
          allowDeleted: true
        });

        return integrationInstanceGroupPresenter.present({ integrationInstanceGroup });
      })
  }
);
