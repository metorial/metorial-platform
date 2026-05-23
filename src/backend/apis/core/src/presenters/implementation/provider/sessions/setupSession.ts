import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { providerSetupSessionType } from '../../../types';
import { v1ProviderAuthConfigPresenter } from '../auth/authConfig';
import { v1ProviderAuthCredentialsPresenter } from '../auth/authCredentials';
import { v1ProviderAuthMethodPresenter } from '../auth/authMethod';
import { v1ConfigPresenter } from '../config/config';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';

export let v1SetupSessionPresenter = Presenter.create(providerSetupSessionType)
  .presenter(async ({ setupSession }, opts) => {
    let configuration = (setupSession as { configuration?: any }).configuration;

    return {
      object: 'provider.setup_session' as const,

      id: setupSession.id,
      type: setupSession.type,
      status: setupSession.status,

      url: setupSession.url,

      name: setupSession.name,
      description: setupSession.description,
      metadata: setupSession.metadata,

      configuration: configuration
        ? {
            provider_search: configuration.providerSearch
              ? {
                  groups: configuration.providerSearch.groups?.map(
                    (group: { groupId: string }) => ({
                      group_id: group.groupId
                    })
                  ),
                  collections: configuration.providerSearch.collections?.map(
                    (collection: { collectionId: string }) => ({
                      collection_id: collection.collectionId
                    })
                  ),
                  categories: configuration.providerSearch.categories?.map(
                    (category: { categoryId: string }) => ({
                      category_id: category.categoryId
                    })
                  )
                }
              : undefined,

            tool_filters: configuration.toolFilters
              ? {
                  enabled: configuration.toolFilters.enabled
                }
              : undefined,

            ui: configuration.ui
              ? {
                  layout: configuration.ui.layout
                }
              : undefined
          }
        : null,

      provider_id: setupSession.providerId ?? null,
      identity_id: setupSession.identityId ?? null,
      identity_credential_id: setupSession.identityCredentialId ?? null,

      auth_method: setupSession.authMethod
        ? await v1ProviderAuthMethodPresenter
            .present({ authMethod: setupSession.authMethod }, opts)
            .run()
        : null,

      deployment: setupSession.deployment
        ? await v1ProviderDeploymentPreviewPresenter
            .present({ deployment: setupSession.deployment }, opts)
            .run()
        : null,

      credentials: setupSession.credentials
        ? await v1ProviderAuthCredentialsPresenter
            .present({ authCredentials: setupSession.credentials }, opts)
            .run()
        : null,

      auth_config: setupSession.authConfig
        ? await v1ProviderAuthConfigPresenter
            .present({ authConfig: setupSession.authConfig }, opts)
            .run()
        : null,

      config: setupSession.config
        ? await v1ConfigPresenter.present({ config: setupSession.config }, opts).run()
        : null,

      ui_mode: setupSession.uiMode,
      redirect_url: setupSession.redirectUrl,

      created_at: setupSession.createdAt,
      updated_at: setupSession.updatedAt,
      expires_at: setupSession.expiresAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.setup_session', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique setup session identifier',
        examples: ['pas_6eFgHjKlMnPqRsTu']
      }),
      type: v.enumOf(['auth_only', 'config_only', 'auth_and_config'], {
        name: 'type',
        description: 'Setup session type'
      }),
      status: v.enumOf(['failed', 'archived', 'deleted', 'pending', 'completed', 'expired'], {
        name: 'status',
        description: 'Session status'
      }),
      url: v.string({
        name: 'url',
        description: 'URL where user completes authentication',
        examples: ['https://provider.metorial.com/setup/pas_6eFgHjKlMnPqRsTu']
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name',
          examples: ['GitHub OAuth Setup']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Connect your GitHub account']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ redirect_uri: 'https://app.example.com/callback' }]
        })
      ),
      configuration: v.nullable(
        v.record(v.any(), {
          name: 'configuration',
          description: 'Setup session configuration'
        })
      ),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Provider ID',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      identity_id: v.nullable(
        v.string({
          name: 'identity_id',
          description: 'Linked identity ID',
          examples: ['idn_3nOpRsTuVwXyZaBc']
        })
      ),
      identity_credential_id: v.nullable(
        v.string({
          name: 'identity_credential_id',
          description: 'Identity credential created from this setup session',
          examples: ['idc_3nOpRsTuVwXyZaBc']
        })
      ),
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      auth_config: v.nullable(v1ProviderAuthConfigPresenter.schema),
      config: v.nullable(v1ConfigPresenter.schema),
      ui_mode: v.enumOf(['metorial_elements', 'dashboard_embeddable'] as const, {
        name: 'ui_mode',
        description: 'UI mode for setup'
      }),
      redirect_url: v.nullable(
        v.string({
          name: 'redirect_url',
          description: 'URL to redirect after setup',
          examples: ['https://app.example.com/callback']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),
      expires_at: v.date({
        name: 'expires_at',
        description: 'Timestamp when the session expires',
        examples: [new Date('2025-09-15T11:30:00Z')]
      })
    }) as any
  )
  .build();
