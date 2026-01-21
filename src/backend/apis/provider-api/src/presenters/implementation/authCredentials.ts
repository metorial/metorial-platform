import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authCredentialsType } from '../types';

export let v1AuthCredentialsPresenter = Presenter.create(authCredentialsType)
  .presenter(async ({ authCredentials }) => ({
    object: 'provider.auth_credentials' as const,
    id: authCredentials.id,
    is_ephemeral: authCredentials.isEphemeral ?? false,
    name: authCredentials.name,
    description: authCredentials.description,
    metadata: authCredentials.metadata,
    provider_id: authCredentials.providerId,
    provider_auth_method_id: authCredentials.providerAuthMethodId ?? authCredentials.authMethodId,
    created_at: authCredentials.createdAt,
    updated_at: authCredentials.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_credentials'),
      id: v.string({ name: 'id', description: 'Unique credentials identifier', examples: ['cred_abc123def456'] }),
      is_ephemeral: v.boolean({ name: 'is_ephemeral', description: 'Whether ephemeral', examples: [false] }),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['API Key'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Production API credentials'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ env: 'production' }] })),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] }),
      provider_auth_method_id: v.string({
        name: 'provider_auth_method_id',
        description: 'Auth method ID',
        examples: ['auth_abc123def456']
      }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
