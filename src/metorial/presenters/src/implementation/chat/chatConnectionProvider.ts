import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatConnectionProviderType } from '../../types';
import { v1ProviderConfigPreviewPresenter } from '../provider/config/configPreview';
import { v1ProviderDeploymentPreviewPresenter } from '../provider/config/deploymentPreview';
import { v1ProviderPreview } from '../provider/provider/providerPreview';

export let v1ChatConnectionProviderPresenter = Presenter.create(chatConnectionProviderType)
  .presenter(async ({ chatConnectionProvider }, opts) => {
    let integrationProvider =
      chatConnectionProvider.adapterIntegrationProvider.integrationProvider;
    let provider = integrationProvider.provider;
    let version = integrationProvider.currentVersion;

    return {
      object: 'chat.connection_provider' as const,

      id: chatConnectionProvider.id,
      status: chatConnectionProvider.status,

      provider: v1ProviderPreview(provider),

      deployment: version
        ? await v1ProviderDeploymentPreviewPresenter
            .present({ deployment: { ...version.deployment, provider } }, opts)
            .run()
        : null,

      config: version?.config
        ? await v1ProviderConfigPreviewPresenter
            .present({ config: { ...version.config, provider } }, opts)
            .run()
        : null,

      auth_method_id: version?.authMethod?.id ?? null,
      auth_credentials_id: version?.authCredentials?.id ?? null,

      name: chatConnectionProvider.name,
      description: chatConnectionProvider.description,

      created_at: chatConnectionProvider.createdAt,
      updated_at: chatConnectionProvider.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('chat.connection_provider', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'Unique chat connection provider identifier',
        examples: ['cip_8kLmNpQrStUvWxYz']
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The chat connection provider status'
      }),

      provider: v1ProviderPreview.schema,

      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),

      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),

      auth_method_id: v.nullable(
        v.string({
          name: 'auth_method_id',
          description: 'The auth method this connection authenticates with, if any',
          examples: ['pam_1aBcDeFgHjKlMnPq']
        })
      ),

      auth_credentials_id: v.nullable(
        v.string({
          name: 'auth_credentials_id',
          description: 'The auth credentials this connection authenticates with, if any',
          examples: ['pac_2bCdEfGhJkLmNpQr']
        })
      ),

      name: v.string({
        name: 'name',
        description: 'Display name of the provider link',
        examples: ['Slack']
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description of the provider link',
          examples: ['Primary Slack workspace connection']
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the provider was linked',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the provider link was last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
