import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerSetupSessionType } from '../../types';
import { v1ProviderAuthConfigPresenter } from './authConfig';
import { v1ProviderAuthCredentialsPresenter } from './authCredentials';
import { v1ProviderAuthMethodPresenter } from './authMethod';
import { v1ConfigPresenter } from './config';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1SetupSessionPresenter = Presenter.create(providerSetupSessionType)
  .presenter(async ({ setupSession }, opts) => ({
    object: 'provider.setup_session' as const,

    id: setupSession.id,
    type: setupSession.type,
    status: setupSession.status,

    url: setupSession.url,

    name: setupSession.name,
    description: setupSession.description,
    metadata: setupSession.metadata,

    provider_id: setupSession.providerId,

    auth_method: await v1ProviderAuthMethodPresenter
      .present({ authMethod: setupSession.authMethod }, opts)
      .run(),

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
  }))
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
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      auth_method: v1ProviderAuthMethodPresenter.schema,
      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      auth_config: v.nullable(v1ProviderAuthConfigPresenter.schema),
      config: v.nullable(v1ConfigPresenter.schema),
      ui_mode: v.string({
        name: 'ui_mode',
        description: 'UI mode for setup',
        examples: ['redirect', 'popup']
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
    })
  )
  .build();
