import { v } from '@lowerdeck/validation';
import type { SubspaceIntegrationPreview } from '@metorial/module-skill';
import { Presenter } from '@metorial/presenter';
import { integrationType } from '../../../types';
import {
  dashboardIntegrationProviderPresenter,
  v1IntegrationProviderPresenter
} from './integrationProvider';

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
      can_override_tool_filters: integration.canOverrideToolFilters,
      enable_callback_tools: integration.enableCallbackTools,
      use_integration_name_in_tool_names:
        integration.useIntegrationNameForSessionProviderNameTemplatesOverride
    },

    implementation: integration.providerTemplateBacking
      ? {
          type: 'provider_template' as const,
          provider_template_id: integration.providerTemplateBacking.id
        }
      : integration.magicMcpServerBacking
        ? {
            type: 'magic_mcp_server' as const,
            magic_mcp_server_id: integration.magicMcpServerBacking.id
          }
        : null,

    providers: await Promise.all(
      integration.providers.map(integrationProvider =>
        v1IntegrationProviderPresenter
          .present({ integrationProvider: { ...integrationProvider, integration } }, opts)
          .run()
      )
    ),
    created_at: integration.createdAt,
    updated_at: integration.updatedAt,
    archived_at: integration.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('integration', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you archive the integration.'
      }),
      slug: v.string({
        description: 'URL-safe name, unique across Metorial.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      configuration: v.object(
        {
          can_attach_custom_tool_filters: v.boolean({
            description: 'Lets integration instances attach their own tool filters.'
          }),
          can_attach_custom_provider_config: v.boolean({
            description: 'Lets integration instances use their own provider configs.'
          }),
          can_override_tool_filters: v.boolean({
            description: 'Lets integration instances ignore the integration tool filters.'
          }),
          enable_callback_tools: v.boolean({
            description: 'Makes callback event tools available for this integration.'
          }),
          use_integration_name_in_tool_names: v.nullable(
            v.boolean({
              description:
                'Names session providers after the integration instead of the provider. `null` uses the default.'
            })
          )
        },
        { description: 'Which settings integration instances may customize.' }
      ),
      implementation: v.nullable(
        v.union(
          [
            v.object({
              type: v.literal('provider_template', {
                description: 'Which kind of backing this is.'
              }),
              provider_template_id: v.string({
                description: 'Provider template this integration is built on.',
                examples: ['ptm_4dEfGhJkLmNpQrSt']
              })
            }),
            v.object({
              type: v.literal('magic_mcp_server', {
                description: 'Which kind of backing this is.'
              }),
              magic_mcp_server_id: v.string({
                description: 'Magic MCP server this integration is built on.'
              })
            })
          ],
          {
            description:
              'What this integration is built on. `null` for a standalone integration.'
          }
        )
      ),
      providers: v.array(v1IntegrationProviderPresenter.schema, {
        description:
          'Providers in this integration, with the deployment, credentials, and tool filters each runs with.'
      }),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
    })
  )
  .build();

export let v1IntegrationPreviewPresenter = Object.assign(
  (
    integration: Pick<
      SubspaceIntegrationPreview,
      | 'id'
      | 'slug'
      | 'name'
      | 'description'
      | 'metadata'
      | 'canAttachCustomToolFilters'
      | 'canAttachCustomProviderConfig'
      | 'canOverrideToolFilters'
      | 'enableCallbackTools'
      | 'useIntegrationNameForSessionProviderNameTemplatesOverride'
      | 'createdAt'
      | 'updatedAt'
      | 'archivedAt'
    >
  ) => ({
    object: 'integration#preview' as const,
    id: integration.id,
    slug: integration.slug,
    name: integration.name,
    description: integration.description,
    metadata: integration.metadata,
    configuration: {
      can_attach_custom_tool_filters: integration.canAttachCustomToolFilters,
      can_attach_custom_provider_config: integration.canAttachCustomProviderConfig,
      can_override_tool_filters: integration.canOverrideToolFilters,
      enable_callback_tools: integration.enableCallbackTools,
      use_integration_name_in_tool_names:
        integration.useIntegrationNameForSessionProviderNameTemplatesOverride
    },
    created_at: integration.createdAt,
    updated_at: integration.updatedAt,
    archived_at: integration.archivedAt
  }),
  {
    schema: v.object({
      object: v.literal('integration#preview', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),
      slug: v.string({
        description: 'URL-safe name, unique across Metorial.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      configuration: v.object(
        {
          can_attach_custom_tool_filters: v.boolean({
            description: 'Lets integration instances attach their own tool filters.'
          }),
          can_attach_custom_provider_config: v.boolean({
            description: 'Lets integration instances use their own provider configs.'
          }),
          can_override_tool_filters: v.boolean({
            description: 'Lets integration instances ignore the integration tool filters.'
          }),
          enable_callback_tools: v.boolean({
            description: 'Makes callback event tools available for this integration.'
          }),
          use_integration_name_in_tool_names: v.nullable(
            v.boolean({
              description:
                'Names session providers after the integration instead of the provider. `null` uses the default.'
            })
          )
        },
        { description: 'Which settings integration instances may customize.' }
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
    })
  }
);

export let dashboardIntegrationPresenter = Presenter.create(integrationType)
  .presenter(async ({ integration }, opts) => {
    let inner = await v1IntegrationPresenter.present({ integration }, opts).run();

    return {
      ...inner,
      providers: await Promise.all(
        integration.providers.map(integrationProvider =>
          dashboardIntegrationProviderPresenter
            .present({ integrationProvider: { ...integrationProvider, integration } }, opts)
            .run()
        )
      )
    };
  })
  .schema(
    v.object({
      ...v1IntegrationPresenter.schema.properties,
      providers: v.array(dashboardIntegrationProviderPresenter.schema)
    }) as any
  )
  .build();
