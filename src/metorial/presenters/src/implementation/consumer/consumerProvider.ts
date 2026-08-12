import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerProviderType } from '../../types';
import { toolFilterPresenter } from '../_shared/toolFilter';
import {
  v1MagicMcpServerPreview,
  v1ProviderAuthMethodPresenter,
  v1ProviderTemplatePreview
} from '../provider';
import { v1ProviderPresenter } from '../provider/provider';

let presentToolFilter = (toolFilter: unknown) =>
  toolFilter ? toolFilterPresenter(toolFilter as PrismaJson.ToolFilter) : null;

export let v1ConsumerProviderPresenter = Presenter.create(consumerProviderType)
  .presenter(async ({ consumerProvider }, opts) => {
    let base = {
      object: 'consumer.provider' as const,
      id: consumerProvider.listing.id,
      name: consumerProvider.listing.name,
      description: consumerProvider.listing.description,
      readme: consumerProvider.listing.readme,
      availability: consumerProvider.availability,
      has_pending_access_request: consumerProvider.hasPendingAccessRequest,
      consumer_access_ids: consumerProvider.consumerAccessIds
    };

    if (consumerProvider.type == 'magic_mcp_server') {
      return {
        ...base,
        type: 'magic_mcp_server' as const,
        name: consumerProvider.listing.name,
        description: consumerProvider.listing.description,
        readme: consumerProvider.listing.readme ?? null,
        availability: consumerProvider.availability,
        has_pending_access_request: consumerProvider.hasPendingAccessRequest,
        magic_mcp_server: v1MagicMcpServerPreview(consumerProvider.magicMcpServer)
      };
    }

    return {
      ...base,
      type: 'provider_template' as const,
      name: consumerProvider.listing.name,
      description: consumerProvider.listing.description,
      readme: consumerProvider.listing.readme ?? null,
      availability: consumerProvider.availability,
      has_pending_access_request: consumerProvider.hasPendingAccessRequest,

      provider_template: v1ProviderTemplatePreview(consumerProvider.providerTemplate),
      provider: await v1ProviderPresenter
        .present(
          {
            provider: consumerProvider.provider
          },
          opts
        )
        .run(),

      deployment: {
        object: 'provider.deployment#preview' as const,
        id: consumerProvider.deployment.id,
        name: consumerProvider.deployment.name,
        description: consumerProvider.deployment.description,
        is_default: consumerProvider.deployment.isDefault,
        provider_id: consumerProvider.deployment.provider.id,
        locked_version_id:
          consumerProvider.deployment.currentVersion?.lockedVersion?.id ?? null
      },
      tool_filter: presentToolFilter(consumerProvider.toolFilter),

      config_schema: consumerProvider.configSchema?.value.specification.configJsonSchema
        ? {
            type: 'json_schema' as const,
            schema: consumerProvider.configSchema.value.specification.configJsonSchema
          }
        : null,

      auth_methods: consumerProvider.authMethods.length
        ? await Promise.all(
            consumerProvider.authMethods.map(authMethod => {
              return v1ProviderAuthMethodPresenter.present({ authMethod }, opts).run();
            })
          )
        : []
    };
  })
  .schema(
    v.union([
      v.object({
        object: v.literal('consumer.provider'),
        id: v.string(),
        name: v.string(),
        description: v.nullable(v.string()),
        readme: v.nullable(v.string()),
        type: v.literal('provider_template'),
        availability: v.enumOf(['available_now', 'request_access']),
        has_pending_access_request: v.boolean(),
        consumer_access_ids: v.array(v.string()),
        provider_template: v1ProviderTemplatePreview.schema,
        provider: v1ProviderPresenter.schema,
        deployment: v.object({
          object: v.literal('provider.deployment#preview'),
          id: v.string(),
          name: v.nullable(v.string()),
          description: v.nullable(v.string()),
          is_default: v.boolean(),
          provider_id: v.string(),
          locked_version_id: v.nullable(v.string())
        }),
        tool_filter: v.nullable(toolFilterPresenter.schema),
        config_schema: v.nullable(
          v.object({
            type: v.literal('json_schema'),
            schema: v.record(v.any())
          })
        ),
        auth_methods: v.array(v1ProviderAuthMethodPresenter.schema)
      }),
      v.object({
        object: v.literal('consumer.provider'),
        id: v.string(),
        name: v.string(),
        description: v.nullable(v.string()),
        readme: v.nullable(v.string()),
        type: v.literal('magic_mcp_server'),
        availability: v.enumOf(['available_now', 'request_access']),
        has_pending_access_request: v.boolean(),
        consumer_access_ids: v.array(v.string()),
        magic_mcp_server: v1MagicMcpServerPreview.schema
      })
    ])
  )
  .build();
