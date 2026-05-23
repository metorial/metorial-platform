import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { scmProviderType } from '../../types';

export let v1ScmProviderPresenter = Presenter.create(scmProviderType)
  .presenter(async ({ scmProvider }) => ({
    object: 'scm.provider' as const,

    id: scmProvider.id,

    type: scmProvider.type,
    name: scmProvider.name,
    description: scmProvider.description,
    api_url: (scmProvider.apiUrl ?? null) as string | null,
    web_url: (scmProvider.webUrl ?? null) as string | null,

    is_default: scmProvider.isDefault,

    created_at: scmProvider.createdAt,
    updated_at: scmProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.provider'),
      id: v.string({ description: 'Unique SCM provider identifier' }),

      type: v.enumOf(['github', 'github_enterprise', 'gitlab', 'gitlab_selfhosted'], {
        description: 'SCM backend type'
      }),
      name: v.string({ description: 'Provider name' }),
      description: v.nullable(v.string({ description: 'Provider description' })),
      api_url: v.nullable(v.string({ description: 'API base URL for the SCM provider' })),
      web_url: v.nullable(v.string({ description: 'Web base URL for the SCM provider' })),

      is_default: v.boolean({ description: 'Whether this is the default provider' }),

      created_at: v.date({ description: 'Timestamp when created' }),
      updated_at: v.date({ description: 'Timestamp when last updated' })
    })
  )
  .build();
