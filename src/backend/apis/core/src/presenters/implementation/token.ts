import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { tokenType } from '../types';

export let v1TokenPresenter = Presenter.create(tokenType)
  .presenter(async ({ token }, opts) => ({
    object: 'token',

    type: token.type
  }))
  .schema(
    v.object({
      object: v.literal('token', {
        description: "String representing the object's type"
      }),

      type: v.enumOf(
        [
          'fine_grained_token',
          'oauth_access_token',
          'unknown_token',
          'user_auth_token',
          'organization_management_token',
          'instance_access_token_secret',
          'instance_access_token_publishable'
        ],
        {
          name: 'type',
          description: `The token's type`
        }
      )
    })
  )
  .build();
