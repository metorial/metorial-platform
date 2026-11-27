import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { consumerOAuthAuthorizationType } from '../../types';

export let v1ConsumerOAuthAuthorizationPresenter = Presenter.create(
  consumerOAuthAuthorizationType
)
  .presenter(async ({ oauthAuthorization }) => ({
    object: 'consumer.oauth_authorization' as const,

    id: oauthAuthorization.id,
    status: oauthAuthorization.status,

    scopes: oauthAuthorization.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    oauth_application: {
      id: oauthAuthorization.oauthApplication.id,
      name: oauthAuthorization.oauthApplication.name,
      description: oauthAuthorization.oauthApplication.description,
      image_url: await getImageUrl(oauthAuthorization.oauthApplication),
      website_url: oauthAuthorization.oauthApplication.websiteUrl
    },

    last_used_at: oauthAuthorization.lastUsedAt,
    revoked_at: oauthAuthorization.revokedAt,
    created_at: oauthAuthorization.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.oauth_authorization', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique OAuth authorization identifier',
        examples: ['oaa_4sTuVwXyZaBcDeFg']
      }),
      status: v.enumOf(['active', 'revoked'], {
        name: 'status',
        description: 'OAuth authorization status'
      }),
      scopes: v.array(
        v.object({
          identifier: v.string({
            name: 'identifier',
            description: 'OAuth scope identifier'
          }),
          name: v.string({
            name: 'name',
            description: 'Human-readable scope name'
          }),
          description: v.string({
            name: 'description',
            description: 'Human-readable scope description'
          })
        }),
        {
          name: 'scopes',
          description: 'Scopes granted to the application'
        }
      ),
      oauth_application: v.object(
        {
          id: v.string({
            name: 'id',
            description: 'OAuth application identifier',
            examples: ['oap_4sTuVwXyZaBcDeFg']
          }),
          name: v.string({
            name: 'name',
            description: 'OAuth application display name',
            examples: ['Acme CLI']
          }),
          description: v.nullable(
            v.string({
              name: 'description',
              description: 'OAuth application description',
              examples: ['Access your portal from the Acme CLI']
            })
          ),
          image_url: v.string({
            name: 'image_url',
            description: 'OAuth application image URL',
            examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
          }),
          website_url: v.nullable(
            v.string({
              name: 'website_url',
              description: 'OAuth application website URL',
              examples: ['https://acme.example.com']
            })
          )
        },
        {
          name: 'oauth_application',
          description: 'The application that was authorized to act as the consumer'
        }
      ),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: 'Timestamp when this authorization was last used'
        })
      ),
      revoked_at: v.nullable(
        v.date({
          name: 'revoked_at',
          description: 'Timestamp when this authorization was revoked'
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this authorization was created'
      })
    })
  )
  .build();
