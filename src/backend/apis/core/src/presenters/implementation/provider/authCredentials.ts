import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerAuthCredentialsType } from '../../types';

export let v1ProviderAuthCredentialsPresenter = Presenter.create(providerAuthCredentialsType)
  .presenter(async ({ authCredentials }) => ({
    object: 'provider.auth_credentials' as const,

    id: authCredentials.id,
    type: authCredentials.type,
    status: authCredentials.status,

    is_default: authCredentials.isDefault,
    is_managed: authCredentials.isManaged,

    name: authCredentials.name,
    description: authCredentials.description,
    metadata: authCredentials.metadata,
    scopes: (authCredentials.scopes ?? null) as string[] | null,

    provider_id: authCredentials.providerId,

    created_at: authCredentials.createdAt,
    updated_at: authCredentials.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_credentials', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique credentials identifier',
        examples: ['par_4sTuVwXyZaBcDeFg']
      }),
      type: v.literal('oauth'),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Credentials status'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this is the default credentials for the provider',
        examples: [true, false]
      }),
      is_managed: v.boolean({
        name: 'is_managed',
        description: 'Whether these credentials are managed by Metorial',
        examples: [true, false]
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Display name', examples: ['GitHub OAuth'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['OAuth credentials for GitHub API']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ app_name: 'My GitHub App', created_by: 'admin@company.com' }]
        })
      ),
      scopes: v.nullable(
        v.array(v.string(), {
          name: 'scopes',
          description: 'OAuth scopes requested by this credential',
          examples: [['read', 'write']]
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
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
    })
  )
  .build();
