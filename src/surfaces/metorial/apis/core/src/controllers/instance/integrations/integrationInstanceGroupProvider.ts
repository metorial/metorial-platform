import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationInstanceGroupProviderService,
  integrationInstanceGroupService
} from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationInstanceGroupProviderPresenter } from '@metorial/presenters';
import { normalizeToolFilters, toolFiltersValidator } from '../sessions/_shared';

let integrationInstanceGroupProviderGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceGroupProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceGroupProviderId is required',
        description: 'The integrationInstanceGroupProviderId path parameter is required.'
      })
    );
  }

  let integrationInstanceGroupProvider =
    await integrationInstanceGroupProviderService.getIntegrationInstanceGroupProviderById({
      instance: ctx.instance,
      integrationInstanceGroupProviderId: ctx.params.integrationInstanceGroupProviderId,
      allowDeleted: true
    });

  return { integrationInstanceGroupProvider };
});

let integrationInstanceGroupGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceGroupId is required',
        description: 'The integrationInstanceGroupId path parameter is required.'
      })
    );
  }

  let integrationInstanceGroup =
    await integrationInstanceGroupService.getIntegrationInstanceGroupById({
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
      'An integration instance group provider links one integration instance provider into a group, with optional tool filters.'
  },
  {
    list: integrationsGroup
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
      .use(requireNonPublishableMachineAccess())
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
              ]),
              {
                description:
                  'Only return group providers with one of these statuses. `deleted` providers are never listed.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers with one of these IDs.'
            }),
            integration_instance_group_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description: 'Only return group providers for one of these groups.'
              }
            ),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers for one of these integrations.'
            }),
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return group providers for one of these integration instances.'
            }),
            integration_instance_provider_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description:
                  'Only return group providers linking one of these integration instance providers.'
              }
            ),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers using one of these providers.'
            }),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return group providers using one of these integration providers.'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers running on one of these deployments.'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers using one of these configs.'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers using one of these credentials.'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return group providers using one of these session templates.'
            }),
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
        let paginator =
          await integrationInstanceGroupProviderService.listIntegrationInstanceGroupProviders({
            instance: ctx.instance,
            allowDeleted: false,
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
          description: 'Retrieves an integration instance group provider.'
        }
      )
      .use(requireNonPublishableMachineAccess())
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
            'Links an existing integration instance provider into the group, with optional tool filters. Creates the link when none exists, otherwise updates its tool filters.'
        }
      )
      .use(requireNonPublishableMachineAccess())
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
          await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProvider({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            integrationInstanceGroup: ctx.integrationInstanceGroup,
            input: {
              integrationInstanceProviderId: ctx.params.integrationInstanceProviderId,
              toolFilters:
                ctx.body.tool_filters === undefined
                  ? undefined
                  : normalizeToolFilters(ctx.body.tool_filters)
            }
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
          name: 'Archive integration instance group provider',
          description:
            'Archives an integration instance group provider. It stays retrievable by ID and listable with `status=archived`.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationInstanceGroupProviderPresenter)
      .do(async ctx => {
        let integrationInstanceGroupProvider =
          await integrationInstanceGroupProviderService.archiveIntegrationInstanceGroupProvider(
            {
              instance: ctx.instance,
              integrationInstanceGroupProvider: ctx.integrationInstanceGroupProvider
            }
          );

        return integrationInstanceGroupProviderPresenter.present({
          integrationInstanceGroupProvider
        });
      })
  }
);
