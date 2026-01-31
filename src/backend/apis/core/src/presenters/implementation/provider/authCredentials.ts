import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authCredentialsType } from '../../types';

let authCredentialsScopeSchema = v.object({
  object: v.literal('provider.auth_credentials.scope', {
    description: "String representing the object's type"
  }),
  id: v.string({
    name: 'id',
    description: 'Unique scope identifier',
    examples: ['pars_7wXyZaBcDeFgHjKl']
  }),
  scope: v.string({
    name: 'scope',
    description: 'OAuth scope string',
    examples: ['repo', 'user:email']
  }),
  name: v.string({
    name: 'name',
    description: 'Display name of the scope',
    examples: ['Repository Access']
  }),
  description: v.nullable(
    v.string({
      name: 'description',
      description: 'Scope description',
      examples: ['Full control of private repositories']
    })
  )
});

export let v1AuthCredentialsPresenter = Presenter.create(authCredentialsType)
  .presenter(async ({ authCredentials }) => ({
    object: 'provider.auth_credentials' as const,
    id: authCredentials.id,
    type: authCredentials.type ?? 'oauth',
    name: authCredentials.name,
    description: authCredentials.description,
    metadata: authCredentials.metadata,
    provider_id: authCredentials.providerId,
    client_id: authCredentials.clientId ?? null,
    scopes:
      authCredentials.scopes?.map(scope => ({
        object: 'provider.auth_credentials.scope' as const,
        id: scope.id,
        scope: scope.scope,
        name: scope.title ?? scope.name,
        description: scope.description
      })) ?? null,
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
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      client_id: v.nullable(
        v.string({
          name: 'client_id',
          description: 'OAuth client ID',
          examples: ['Iv1.abc123def456']
        })
      ),
      scopes: v.nullable(
        v.array(authCredentialsScopeSchema, {
          name: 'scopes',
          description: 'OAuth scopes granted to these credentials'
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
    })
  )
  .build();
