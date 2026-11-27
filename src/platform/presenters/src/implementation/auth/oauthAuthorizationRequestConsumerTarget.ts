import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { oauthAuthorizationRequestConsumerTargetType } from '../../types';

export let v1OAuthAuthorizationRequestConsumerTargetPresenter = Presenter.create(
  oauthAuthorizationRequestConsumerTargetType
)
  .presenter(async ({ consumerProfile }) => ({
    object: 'machine_access.oauth_authorization_request.consumer_target',

    consumer_profile_id: consumerProfile.id,

    portal: consumerProfile.surface.portal
      ? {
          id: consumerProfile.surface.portal.id,
          name: consumerProfile.surface.portal.name,
          slug: consumerProfile.surface.portal.slug
        }
      : null,

    organization: {
      id: consumerProfile.organization.id,
      name: consumerProfile.organization.name
    },

    instance: {
      id: consumerProfile.instance.id,
      name: consumerProfile.instance.name
    },

    consumer: {
      name: consumerProfile.name,
      email: consumerProfile.email
    }
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.oauth_authorization_request.consumer_target', {
        description: "String representing the object's type"
      }),
      consumer_profile_id: v.string({
        name: 'consumer_profile_id',
        description: 'Consumer profile to pass when approving the authorization request',
        examples: ['cop_4sTuVwXyZaBcDeFg']
      }),
      portal: v.nullable(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: 'Portal identifier',
              examples: ['ptl_4sTuVwXyZaBcDeFg']
            }),
            name: v.string({
              name: 'name',
              description: 'Portal display name',
              examples: ['Acme Portal']
            }),
            slug: v.string({
              name: 'slug',
              description: 'Portal slug',
              examples: ['acme']
            })
          },
          {
            name: 'portal',
            description: 'Portal the consumer profile belongs to'
          }
        )
      ),
      organization: v.object(
        {
          id: v.string({
            name: 'id',
            description: 'Organization identifier',
            examples: ['org_7hNkPqRsTuVwXyZa']
          }),
          name: v.string({
            name: 'name',
            description: 'Organization display name',
            examples: ['Acme Inc.']
          })
        },
        {
          name: 'organization',
          description: 'Organization that owns the portal'
        }
      ),
      instance: v.object(
        {
          id: v.string({
            name: 'id',
            description: 'Instance identifier',
            examples: ['ins_4sTuVwXyZaBcDeFg']
          }),
          name: v.string({
            name: 'name',
            description: 'Instance display name',
            examples: ['Production']
          })
        },
        {
          name: 'instance',
          description: 'Instance the portal belongs to'
        }
      ),
      consumer: v.object(
        {
          name: v.string({
            name: 'name',
            description: 'Consumer display name on this portal',
            examples: ['Jane Doe']
          }),
          email: v.string({
            name: 'email',
            description: 'Consumer email address on this portal',
            examples: ['jane@acme.example.com']
          })
        },
        {
          name: 'consumer',
          description: 'The consumer identity the app will act as'
        }
      )
    })
  )
  .build();
