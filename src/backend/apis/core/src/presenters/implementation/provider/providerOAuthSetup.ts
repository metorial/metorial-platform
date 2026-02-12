import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOAuthSetupType } from '../../types';
import { v1AuthMethodPresenter } from './authMethod';

let authConfigSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'Auth config identifier',
    examples: ['pac_1aBcDeFgHjKlMnPq']
  }),
  status: v.nullable(
    v.string({
      name: 'status',
      description: 'Auth config status',
      examples: ['active', 'inactive']
    })
  ),
  type: v.nullable(
    v.string({
      name: 'type',
      description: 'Auth config type',
      examples: ['oauth2']
    })
  ),
  name: v.nullable(
    v.string({
      name: 'name',
      description: 'Auth config name',
      examples: ['Production OAuth']
    })
  ),
  description: v.nullable(
    v.string({
      name: 'description',
      description: 'Auth config description',
      examples: ['OAuth configuration for production']
    })
  ),
  metadata: v.nullable(
    v.record(v.any(), {
      name: 'metadata',
      description: 'Custom key-value pairs',
      examples: [{ environment: 'production' }]
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
      description: 'Provider deployment ID',
      examples: ['pde_1aBcDeFgHjKlMnPq']
    })
  ),
  provider_auth_method_id: v.nullable(
    v.string({
      name: 'provider_auth_method_id',
      description: 'Provider auth method ID',
      examples: ['pam_1aBcDeFgHjKlMnPq']
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
  })
});

let credentialsSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'Credentials identifier',
    examples: ['pcr_1aBcDeFgHjKlMnPq']
  }),
  type: v.nullable(
    v.string({
      name: 'type',
      description: 'Credentials type',
      examples: ['oauth2']
    })
  ),
  name: v.nullable(
    v.string({
      name: 'name',
      description: 'Credentials name',
      examples: ['Production Credentials']
    })
  ),
  description: v.nullable(
    v.string({
      name: 'description',
      description: 'Credentials description',
      examples: ['OAuth credentials for production']
    })
  ),
  metadata: v.nullable(
    v.record(v.any(), {
      name: 'metadata',
      description: 'Custom key-value pairs',
      examples: [{ environment: 'production' }]
    })
  ),
  provider_id: v.string({
    name: 'provider_id',
    description: 'Provider ID',
    examples: ['pro_5gHjKlMnPqRsTuVw']
  }),
  client_id: v.nullable(
    v.string({
      name: 'client_id',
      description: 'OAuth client ID',
      examples: ['client_abc123']
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
  })
});

let deploymentPreviewSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'Deployment identifier',
    examples: ['pde_1aBcDeFgHjKlMnPq']
  }),
  name: v.nullable(
    v.string({
      name: 'name',
      description: 'Deployment name',
      examples: ['Production']
    })
  ),
  provider_id: v.string({
    name: 'provider_id',
    description: 'Provider ID',
    examples: ['pro_5gHjKlMnPqRsTuVw']
  })
});

export let v1ProviderOAuthSetupPresenter = Presenter.create(providerOAuthSetupType)
  .presenter(async ({ providerOAuthSetup }, opts) => ({
    object: 'provider.oauth_setup' as const,
    id: providerOAuthSetup.id,
    status: providerOAuthSetup.status,
    is_ephemeral: providerOAuthSetup.isEphemeral ?? false,
    provider_id: providerOAuthSetup.providerId,
    name: providerOAuthSetup.name,
    description: providerOAuthSetup.description,
    metadata: providerOAuthSetup.metadata,
    redirect_url: providerOAuthSetup.redirectUrl ?? null,
    url: providerOAuthSetup.url ?? null,
    auth_config: providerOAuthSetup.authConfig
      ? {
          id: providerOAuthSetup.authConfig.id,
          status: providerOAuthSetup.authConfig.status ?? null,
          type: providerOAuthSetup.authConfig.type ?? null,
          name: providerOAuthSetup.authConfig.name,
          description: providerOAuthSetup.authConfig.description,
          metadata: providerOAuthSetup.authConfig.metadata,
          provider_id: providerOAuthSetup.authConfig.providerId,
          provider_deployment_id: providerOAuthSetup.authConfig.providerDeploymentId ?? null,
          provider_auth_method_id: providerOAuthSetup.authConfig.providerAuthMethodId ?? null,
          created_at: providerOAuthSetup.authConfig.createdAt,
          updated_at: providerOAuthSetup.authConfig.updatedAt
        }
      : null,
    credentials: providerOAuthSetup.credentials
      ? {
          id: providerOAuthSetup.credentials.id,
          type: providerOAuthSetup.credentials.type ?? null,
          name: providerOAuthSetup.credentials.name,
          description: providerOAuthSetup.credentials.description,
          metadata: providerOAuthSetup.credentials.metadata,
          provider_id: providerOAuthSetup.credentials.providerId,
          client_id: providerOAuthSetup.credentials.clientId ?? null,
          created_at: providerOAuthSetup.credentials.createdAt,
          updated_at: providerOAuthSetup.credentials.updatedAt
        }
      : null,
    auth_method: providerOAuthSetup.authMethod
      ? await v1AuthMethodPresenter
          .present({ authMethod: providerOAuthSetup.authMethod }, opts)
          .run()
      : null,
    deployment: providerOAuthSetup.deployment
      ? {
          id: providerOAuthSetup.deployment.id,
          name: providerOAuthSetup.deployment.name,
          provider_id: providerOAuthSetup.deployment.providerId
        }
      : null,
    created_at: providerOAuthSetup.createdAt,
    updated_at: providerOAuthSetup.updatedAt,
    expires_at: providerOAuthSetup.expiresAt ?? null
  }))
  .schema(
    v.object({
      object: v.literal('provider.oauth_setup', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique OAuth setup identifier',
        examples: ['pos_1aBcDeFgHjKlMnPq']
      }),
      status: v.nullable(
        v.string({
          name: 'status',
          description: 'Current OAuth setup status',
          examples: ['unused', 'opened', 'completed', 'expired']
        })
      ),
      is_ephemeral: v.boolean({
        name: 'is_ephemeral',
        description: 'Whether this setup is ephemeral'
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'OAuth setup name',
          examples: ['GitHub OAuth Setup']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'OAuth setup description',
          examples: ['Setup OAuth for GitHub integration']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ environment: 'production' }]
        })
      ),
      redirect_url: v.nullable(
        v.string({
          name: 'redirect_url',
          description: 'URL to redirect to after OAuth completion',
          examples: ['https://app.example.com/oauth/callback']
        })
      ),
      url: v.nullable(
        v.string({
          name: 'url',
          description: 'OAuth setup URL for users to complete the setup',
          examples: ['https://oauth.metorial.com/setup/pos_1aBcDeFgHjKlMnPq']
        })
      ),
      auth_config: v.nullable(authConfigSchema),
      credentials: v.nullable(credentialsSchema),
      auth_method: v.nullable(v1AuthMethodPresenter.schema),
      deployment: v.nullable(deploymentPreviewSchema),
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
          description: 'Timestamp when the setup expires',
          examples: [new Date('2025-09-16T10:30:00Z')]
        })
      )
    })
  )
  .build();
