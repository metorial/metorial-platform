import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { integrationType } from '../../../types';
import { v1IntegrationProviderPresenter } from './integrationProvider';

export let v1IntegrationPresenter = Presenter.create(integrationType)
  .presenter(async ({ integration }, opts) => ({
    object: 'integration' as const,
    id: integration.id,
    status: integration.status,
    slug: integration.slug,
    name: integration.name,
    description: integration.description,
    metadata: integration.metadata,

    configuration: {
      can_attach_custom_tool_filters: integration.canAttachCustomToolFilters,
      can_attach_custom_provider_config: integration.canAttachCustomProviderConfig,
      can_override_tool_filters: integration.canOverrideToolFilters
    },

    implementation: integration.providerTemplateBackingId
      ? {
          type: 'provider_template' as const,
          provider_template_id: integration.providerTemplateBackingId
        }
      : integration.magicMcpServerBackingId
        ? {
            type: 'magic_mcp_server' as const,
            magic_mcp_server_id: integration.magicMcpServerBackingId
          }
        : null,

    providers: await Promise.all(
      integration.providers.map(integrationProvider =>
        v1IntegrationProviderPresenter.present({ integrationProvider }, opts).run()
      )
    ),
    created_at: integration.createdAt,
    updated_at: integration.updatedAt,
    archived_at: integration.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      slug: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      configuration: v.object({
        can_attach_custom_tool_filters: v.boolean(),
        can_attach_custom_provider_config: v.boolean(),
        can_override_tool_filters: v.boolean()
      }),
      implementation: v.nullable(
        v.union([
          v.object({
            type: v.literal('provider_template'),
            provider_template_id: v.string()
          }),
          v.object({
            type: v.literal('magic_mcp_server'),
            magic_mcp_server_id: v.string()
          })
        ])
      ),
      providers: v.array(v1IntegrationProviderPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
