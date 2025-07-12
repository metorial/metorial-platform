import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerOauthConnectionTemplateType } from '../types';
import { v1ProfilePresenter } from './profile';

export let v1ProviderOauthConnectionTemplatePresenter = Presenter.create(
  providerOauthConnectionTemplateType
)
  .presenter(async ({ providerOauthConnectionTemplate }, opts) => ({
    object: 'provider_oauth.connection_template',

    id: providerOauthConnectionTemplate.id,
    status: providerOauthConnectionTemplate.status,

    slug: providerOauthConnectionTemplate.slug,

    name: providerOauthConnectionTemplate.name,
    provider: {
      name: providerOauthConnectionTemplate.providerName,
      url: providerOauthConnectionTemplate.providerUrl
    },

    variables: providerOauthConnectionTemplate.variables.map(variable => ({
      key: variable.key,
      type: variable.type,
      label: variable.label,
      description: variable.description ?? null
    })),
    scopes: providerOauthConnectionTemplate.scopes.map(scope => ({
      name: scope.name,
      identifier: scope.identifier
    })),

    profile: await v1ProfilePresenter
      .present(
        {
          profile: providerOauthConnectionTemplate.profile
        },
        opts
      )
      .run(),

    created_at: providerOauthConnectionTemplate.createdAt,
    updated_at: providerOauthConnectionTemplate.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider_oauth.connection_template'),

      id: v.string(),
      status: v.enumOf(['active', 'archived']),

      slug: v.string(),

      name: v.string(),
      provider: v.object({
        name: v.string(),
        url: v.string()
      }),

      scopes: v.array(
        v.object({
          name: v.string(),
          identifier: v.string()
        })
      ),
      variables: v.array(
        v.object({
          key: v.string(),
          type: v.enumOf(['string']),
          label: v.string(),
          description: v.nullable(v.string())
        })
      ),

      profile: v1ProfilePresenter.schema,

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
