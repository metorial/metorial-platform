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
      identifier: scope.identifier,
      description: scope.description
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

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this OAuth connection template'
      }),

      status: v.enumOf(['active', 'archived'], {
        name: 'status',
        description: 'The lifecycle status of the connection template'
      }),

      slug: v.string({
        name: 'slug',
        description: 'A URL-friendly identifier for the template'
      }),

      name: v.string({
        name: 'name',
        description: 'The display name of the connection template'
      }),

      provider: v.object(
        {
          name: v.string({
            name: 'name',
            description: 'The name of the OAuth provider (e.g., GitHub, Google)'
          }),
          url: v.string({
            name: 'url',
            description: 'The base URL of the provider’s OAuth API'
          })
        },
        {
          name: 'provider',
          description: 'Information about the OAuth provider associated with this template'
        }
      ),

      scopes: v.array(
        v.object(
          {
            identifier: v.string({
              name: 'identifier',
              description: 'The unique identifier for the scope (as defined by the provider)'
            }),
            description: v.string({
              name: 'description',
              description: 'A human-readable description of what access the scope provides'
            })
          },
          {
            name: 'scope',
            description: 'An individual permission scope requested during OAuth authorization'
          }
        ),
        {
          name: 'scopes',
          description: 'The list of OAuth scopes required by the template'
        }
      ),

      variables: v.array(
        v.object(
          {
            key: v.string({
              name: 'key',
              description: 'The internal key used to reference this variable'
            }),
            type: v.enumOf(['string'], {
              name: 'type',
              description: 'The expected data type of the variable'
            }),
            label: v.string({
              name: 'label',
              description: 'A human-readable label for UI display'
            }),
            description: v.nullable(
              v.string({
                name: 'description',
                description: 'Optional help text or explanation for the variable'
              })
            )
          },
          {
            name: 'variable',
            description: 'A configurable variable required by the template'
          }
        ),
        {
          name: 'variables',
          description: 'A list of variables required for this OAuth template to function'
        }
      ),

      profile: v1ProfilePresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the connection template was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the template was last updated'
      })
    })
  )
  .build();
