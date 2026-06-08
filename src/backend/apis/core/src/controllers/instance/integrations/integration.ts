import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceIntegrationService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationPresenter } from '../../../presenters';

let integrationGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationId is required',
        description: 'The integrationId path parameter is required.'
      })
    );
  }

  let integration = await subspaceIntegrationService.get({
    instance: ctx.instance,
    integrationId: ctx.params.integrationId,
    allowDeleted: true
  });

  return { integration };
});

export let integrationController = Controller.create(
  {
    name: 'Integrations',
    description:
      'Integrations define reusable provider contracts that can then be materialized into integration instances.'
  },
  {
    list: instanceGroup
      .get(instancePath('integrations', 'integrations.list'), {
        name: 'List integrations',
        description: 'Returns a paginated list of integrations.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationPresenter)
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
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('integration creation time'),
            updated_at: dateFilterValidator('integration last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIntegrationService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, integration =>
          integrationPresenter.present({ integration })
        );
      }),

    get: integrationGroup
      .get(instancePath('integrations/:integrationId', 'integrations.get'), {
        name: 'Get integration',
        description: 'Retrieves a specific integration.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationPresenter)
      .do(async ctx => integrationPresenter.present({ integration: ctx.integration })),

    create: instanceGroup
      .post(instancePath('integrations', 'integrations.create'), {
        name: 'Create integration',
        description: 'Creates a new integration.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          can_attach_custom_tool_filters: v.optional(v.boolean()),
          can_attach_custom_provider_config: v.optional(v.boolean()),
          can_override_tool_filters: v.optional(v.boolean())
        })
      )
      .output(integrationPresenter)
      .do(async ctx => {
        let integration = await subspaceIntegrationService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          canAttachCustomToolFilters: ctx.body.can_attach_custom_tool_filters,
          canAttachCustomProviderConfig: ctx.body.can_attach_custom_provider_config,
          canOverrideToolFilters: ctx.body.can_override_tool_filters
        });

        return integrationPresenter.present({ integration });
      }),

    update: integrationGroup
      .patch(instancePath('integrations/:integrationId', 'integrations.update'), {
        name: 'Update integration',
        description: 'Updates a specific integration.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          can_attach_custom_tool_filters: v.optional(v.boolean()),
          can_attach_custom_provider_config: v.optional(v.boolean()),
          can_override_tool_filters: v.optional(v.boolean())
        })
      )
      .output(integrationPresenter)
      .do(async ctx => {
        let integration = await subspaceIntegrationService.update({
          instance: ctx.instance,
          integrationId: ctx.integration.id,
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          canAttachCustomToolFilters: ctx.body.can_attach_custom_tool_filters,
          canAttachCustomProviderConfig: ctx.body.can_attach_custom_provider_config,
          canOverrideToolFilters: ctx.body.can_override_tool_filters
        });

        return integrationPresenter.present({ integration });
      }),

    delete: integrationGroup
      .delete(instancePath('integrations/:integrationId', 'integrations.delete'), {
        name: 'Delete integration',
        description: 'Archives a specific integration.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationPresenter)
      .do(async ctx => {
        let integration = await subspaceIntegrationService.delete({
          instance: ctx.instance,
          integrationId: ctx.integration.id,
          allowDeleted: true
        });

        return integrationPresenter.present({ integration });
      })
  }
);
