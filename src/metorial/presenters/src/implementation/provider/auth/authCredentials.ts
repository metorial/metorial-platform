import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerAuthCredentialsType } from '../../../types';

export let v1ProviderAuthCredentialsPresenter = Presenter.create(providerAuthCredentialsType)
  .presenter(async ({ authCredentials }) => ({
    object: 'provider.auth_credentials' as const,

    id: authCredentials.id,
    type: authCredentials.type,
    status: authCredentials.status,

    is_default: authCredentials.isDefault,
    is_managed: authCredentials.origin !== 'tenant_created',
    managed_by:
      authCredentials.origin === 'tenant_created'
        ? null
        : authCredentials.origin === 'installation_template'
          ? ('installation' as const)
          : ('metorial' as const),

    name: authCredentials.name,
    description: authCredentials.description,
    metadata: authCredentials.metadata,
    scopes: (authCredentials.scopes ?? null) as string[] | null,

    provider_id: authCredentials.provider.id,

    created_at: authCredentials.createdAt,
    updated_at: authCredentials.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_credentials', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['par_4sTuVwXyZaBcDeFg']
      }),
      type: v.literal('oauth', { description: 'Must be `oauth`.' }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description:
          'Archived once the credentials are archived. Archived credentials stay listable.'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: "Used when a request doesn't name credentials.",
        examples: [true, false]
      }),
      is_managed: v.boolean({
        name: 'is_managed',
        description:
          'Whether Metorial or the installation administrator manages these OAuth credentials.',
        examples: [true, false]
      }),
      managed_by: v.nullable(
        v.enumOf(['metorial', 'installation'], {
          name: 'managed_by',
          description:
            'Who manages these credentials: Metorial, or the administrator of this self-hosted installation. Null for credentials created in the project.'
        })
      ),
      name: v.nullable(
        v.string({ name: 'name', description: 'Display name.', examples: ['GitHub OAuth'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['OAuth credentials for GitHub API']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
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
        description: 'Provider these credentials belong to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
