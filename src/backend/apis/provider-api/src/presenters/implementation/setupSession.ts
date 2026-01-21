import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { setupSessionType } from '../types';

export let v1SetupSessionPresenter = Presenter.create(setupSessionType)
  .presenter(async ({ setupSession }) => ({
    object: 'provider.setup_session' as const,
    id: setupSession.id,
    status: setupSession.status ?? 'pending',
    name: setupSession.name,
    description: setupSession.description,
    metadata: setupSession.metadata,
    provider_id: setupSession.providerId,
    provider_deployment_id: setupSession.providerDeploymentId ?? setupSession.deploymentId,
    provider_auth_method_id: setupSession.providerAuthMethodId ?? setupSession.authMethodId,
    ui_mode: setupSession.uiMode,
    redirect_url: setupSession.redirectUrl,
    url: setupSession.setupUrl,
    created_at: setupSession.createdAt,
    updated_at: setupSession.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.setup_session'),
      id: v.string({
        name: 'id',
        description: 'Unique setup session identifier',
        examples: ['sess_abc123def456']
      }),
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
          description: 'Custom metadata',
          examples: [{ flow: 'oauth' }]
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pvd_abc123def456']
      }),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Deployment ID',
          examples: ['dep_abc123def456']
        })
      ),
      provider_auth_method_id: v.string({
        name: 'provider_auth_method_id',
        description: 'Auth method ID',
        examples: ['auth_abc123def456']
      }),
      ui_mode: v.nullable(
        v.string({
          name: 'ui_mode',
          description: 'UI mode (popup, redirect)',
          examples: ['popup', 'redirect']
        })
      ),
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
          examples: ['https://provider.metorial.com/setup/sess_abc123']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2024-01-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2024-06-20T14:45:00Z')]
      })
    })
  )
  .build();
