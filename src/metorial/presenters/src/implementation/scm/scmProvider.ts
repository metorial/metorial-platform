import { checkEdition } from '@metorial/editions';
import { v } from '@lowerdeck/validation';
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
    ...(checkEdition('on-prem') ? { app_webhook_url: scmProvider.appWebhookUrl ?? null } : {}),

    created_at: scmProvider.createdAt,
    updated_at: scmProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('scm.provider', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),

      type: v.enumOf(
        [
          'github',
          'github_enterprise',
          'gitlab',
          'gitlab_selfhosted',
          'bitbucket',
          'bitbucket_data_center'
        ],
        {
          description: 'Provider software this connects to.'
        }
      ),
      name: v.string({ description: 'Display name.' }),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      api_url: v.nullable(
        v.string({
          description: 'Base URL for the provider API. `null` when using the provider default.'
        })
      ),
      web_url: v.nullable(
        v.string({
          description:
            'Base URL for the provider website. `null` when using the provider default.'
        })
      ),

      is_default: v.boolean({
        description: 'Used when no other provider is specified.'
      }),
      ...(checkEdition('on-prem')
        ? {
            app_webhook_url: v.nullable(
              v.string({ description: 'Webhook URL for the configured GitHub application.' })
            )
          }
        : {}),

      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();
