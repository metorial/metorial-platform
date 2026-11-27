import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { integrationService } from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationPresenter } from '@metorial/presenters';

let integrationGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationId is required',
        description: 'The integrationId path parameter is required.'
      })
    );
  }

  let integration = await integrationService.getIntegrationById({
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
      'An integration is a reusable set of providers with shared configuration. Integration instances connect it for a specific actor or identity.'
  },
  {
    list: integrationsGroup
      .get(instancePath('integrations', 'integrations.list'), {
        name: 'List integrations',
        description: 'Returns a paginated list of integrations.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), {
              description: 'Search integrations by name, description, ID, or slug.'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description:
                  'Only return integrations with one of these statuses. `deleted` integrations are never listed.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integrations with one of these IDs.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integrations using one of these providers.'
            }),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integrations using one of these integration providers.'
            }),
            created_at: dateFilterValidator('integration creation time'),
            updated_at: dateFilterValidator('integration last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationService.listIntegrations({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: false,
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
        description: 'Retrieves an integration.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationPresenter)
      .do(async ctx => integrationPresenter.present({ integration: ctx.integration })),

    create: integrationsGroup
      .post(instancePath('integrations', 'integrations.create'), {
        name: 'Create integration',
        description: 'Creates an integration.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({
            description: 'Display name for the integration.',
            examples: ['GitHub']
          }),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the integration.'
            })
          ),
          use_integration_name_in_tool_names: v.optional(
            v.nullable(
              v.boolean({
                description:
                  'Names session providers after the integration instead of the provider. `null` uses the default.'
              })
            )
          ),
          can_attach_custom_tool_filters: v.optional(
            v.boolean({
              description: 'Lets integration instances attach their own tool filters.'
            })
          ),
          can_attach_custom_provider_config: v.optional(
            v.boolean({
              description: 'Lets integration instances use their own provider configs.'
            })
          ),
          can_override_tool_filters: v.optional(
            v.boolean({
              description: 'Lets integration instances ignore the integration tool filters.'
            })
          ),
          enable_callback_tools: v.optional(
            v.boolean({
              description: 'Makes callback event tools available for this integration.'
            })
          )
        })
      )
      .output(integrationPresenter)
      .do(async ctx => {
        let integration = await integrationService.createIntegration({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            useIntegrationNameForSessionProviderNameTemplatesOverride:
              ctx.body.use_integration_name_in_tool_names,
            canAttachCustomToolFilters: ctx.body.can_attach_custom_tool_filters,
            canAttachCustomProviderConfig: ctx.body.can_attach_custom_provider_config,
            canOverrideToolFilters: ctx.body.can_override_tool_filters,
            enableCallbackTools: ctx.body.enable_callback_tools
          }
        });

        return integrationPresenter.present({ integration });
      }),

    update: integrationGroup
      .patch(instancePath('integrations/:integrationId', 'integrations.update'), {
        name: 'Update integration',
        description: 'Updates an integration. Omitted fields keep their current value.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name for the integration.',
              examples: ['GitHub']
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Free-text description. `null` clears it.'
              })
            )
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description:
                  'Custom data to identify or organize the integration. Replaces existing metadata. `null` clears it.'
              })
            )
          ),
          use_integration_name_in_tool_names: v.optional(
            v.nullable(
              v.boolean({
                description:
                  'Names session providers after the integration instead of the provider. `null` uses the default.'
              })
            )
          ),
          can_attach_custom_tool_filters: v.optional(
            v.boolean({
              description: 'Lets integration instances attach their own tool filters.'
            })
          ),
          can_attach_custom_provider_config: v.optional(
            v.boolean({
              description: 'Lets integration instances use their own provider configs.'
            })
          ),
          can_override_tool_filters: v.optional(
            v.boolean({
              description: 'Lets integration instances ignore the integration tool filters.'
            })
          ),
          enable_callback_tools: v.optional(
            v.boolean({
              description: 'Makes callback event tools available for this integration.'
            })
          )
        })
      )
      .output(integrationPresenter)
      .do(async ctx => {
        let integration = await integrationService.updateIntegration({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integration: ctx.integration,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            useIntegrationNameForSessionProviderNameTemplatesOverride:
              ctx.body.use_integration_name_in_tool_names,
            canAttachCustomToolFilters: ctx.body.can_attach_custom_tool_filters,
            canAttachCustomProviderConfig: ctx.body.can_attach_custom_provider_config,
            canOverrideToolFilters: ctx.body.can_override_tool_filters,
            enableCallbackTools: ctx.body.enable_callback_tools
          }
        });

        return integrationPresenter.present({ integration });
      }),

    delete: integrationGroup
      .delete(instancePath('integrations/:integrationId', 'integrations.delete'), {
        name: 'Archive integration',
        description:
          'Archives an integration. It stays retrievable by ID and listable with `status=archived`.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationPresenter)
      .do(async ctx => {
        let integration = await integrationService.archiveIntegration({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integration: ctx.integration
        });

        return integrationPresenter.present({ integration });
      })
  }
);
