import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerProviderType } from '../types';
import { v1MagicMcpServerPreview } from './magicMcpServerPreview';
import { v1ProviderAuthMethodPresenter } from './provider/authMethod';
import { v1ProviderPresenter } from './provider/provider';

export let v1ConsumerProviderPresenter = Presenter.create(consumerProviderType)
  .presenter(async ({ consumerProvider }, opts) => {
    if (consumerProvider.type == 'magic_mcp_server') {
      return {
        object: 'consumer.provider' as const,
        id: consumerProvider.magicMcpServer.id,
        type: 'magic_mcp_server' as const,
        availability: consumerProvider.availability,
        has_pending_access_request: consumerProvider.hasPendingAccessRequest,
        magic_mcp_server: v1MagicMcpServerPreview(consumerProvider.magicMcpServer)
      };
    }

    return {
      object: 'consumer.provider' as const,
      id: consumerProvider.providerTemplate.id,
      type: 'provider_template' as const,
      availability: consumerProvider.availability,
      has_pending_access_request: consumerProvider.hasPendingAccessRequest,
      provider_template: {
        object: 'provider.template#preview' as const,
        id: consumerProvider.providerTemplate.id,
        status: consumerProvider.providerTemplate.status,
        name: consumerProvider.providerTemplate.name,
        description: consumerProvider.providerTemplate.description,
        metadata: consumerProvider.providerTemplate.metadata,
        provider_deployment_id: consumerProvider.providerTemplate.providerDeploymentId
      },
      provider: await v1ProviderPresenter.present({ provider: consumerProvider.provider }, opts).run(),
      deployment: {
        object: 'provider.deployment#preview' as const,
        id: consumerProvider.deployment.id,
        name: consumerProvider.deployment.name,
        description: consumerProvider.deployment.description,
        is_default: consumerProvider.deployment.isDefault,
        provider_id: consumerProvider.deployment.providerId,
        locked_version_id: consumerProvider.deployment.lockedVersion?.id ?? null
      },
      config_schema: consumerProvider.configSchema?.configSchema
        ? {
            type: 'json_schema' as const,
            schema: consumerProvider.configSchema.configSchema
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
        type: v.literal('provider_template'),
        availability: v.enumOf(['available_now', 'request_access']),
        has_pending_access_request: v.boolean(),
        provider_template: v.object({
          object: v.literal('provider.template#preview'),
          id: v.string(),
          status: v.enumOf(['active', 'archived', 'deleted']),
          name: v.string(),
          description: v.nullable(v.string()),
          metadata: v.record(v.any()),
          provider_deployment_id: v.string()
        }),
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
        type: v.literal('magic_mcp_server'),
        availability: v.enumOf(['available_now', 'request_access']),
        has_pending_access_request: v.boolean(),
        magic_mcp_server: v1MagicMcpServerPreview.schema
      })
    ])
  )
  .build();
