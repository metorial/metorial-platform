import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { setupSessionType } from '../../types';
import { v1AuthConfigPresenter } from './authConfig';

export let v1SetupSessionPresenter = Presenter.create(setupSessionType)
  .presenter(async ({ setupSession }, opts) => ({
    object: 'provider.setup_session' as const,
    id: setupSession.id,
    type: setupSession.type ?? 'oauth',
    status: setupSession.status ?? 'pending',
    name: setupSession.name,
    description: setupSession.description,
    metadata: setupSession.metadata,
    provider_id: setupSession.providerId,
    provider_deployment_id: setupSession.providerDeploymentId ?? setupSession.deploymentId,
    provider_auth_method_id: setupSession.providerAuthMethodId ?? setupSession.authMethodId,
    redirect_url: setupSession.redirectUrl,
    url: setupSession.setupUrl ?? setupSession.url,
    created_at: setupSession.createdAt,
    updated_at: setupSession.updatedAt,
    expires_at: setupSession.expiresAt ?? null,
    auth_config: setupSession.authConfig
      ? await v1AuthConfigPresenter.present({ authConfig: setupSession.authConfig }, opts).run()
      : null
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
      type: v.literal('oauth'),
      status: v.string({
        name: 'status',
        description: 'Session status (pending, in_progress, completed, failed, expired)',
        examples: ['pending', 'completed']
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
          description: 'Custom key-value pairs for storing additional information',
          examples: [
            {
              redirect_uri: 'https://app.example.com/callback',
              requested_scopes: ['repo', 'user']
            }
          ]
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Deployment ID',
          examples: ['pde_1aBcDeFgHjKlMnPq']
        })
      ),
      provider_auth_method_id: v.string({
        name: 'provider_auth_method_id',
        description: 'Auth method ID',
        examples: ['pam_2mNpQrStUvWxYzAb']
      }),
      redirect_url: v.nullable(
        v.string({
          name: 'redirect_url',
          description: 'URL to redirect after setup',
          examples: ['https://app.example.com/callback']
        })
      ),
      url: v.nullable(
        v.string({
          name: 'url',
          description: 'URL where user completes authentication',
          examples: ['https://provider.metorial.com/setup/pas_6eFgHjKlMnPqRsTu']
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
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'Timestamp when the session expires',
          examples: [new Date('2025-09-15T11:30:00Z')]
        })
      ),
      auth_config: v.nullable(v1AuthConfigPresenter.schema)
    })
  )
  .build();
