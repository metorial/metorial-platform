import { Controller, Path } from '@metorial/rest';
import { apiGroup } from '../../middleware/apiGroup';
import { tokenPresenter } from '../../presenters';

export let tokenController = Controller.create(
  {
    name: 'Token',
    description:
      'Endpoint for retrieving metadata about the token used for authentication. This is useful for clients to understand the type and capabilities of the token they are using, especially since Metorial supports multiple token types with different permission models.',
    hideInDocs: true
  },
  {
    get: apiGroup
      .get(Path('token', 'token.get'), {
        name: 'Get token details',
        description: 'Retrieves metadata and configuration details for a specific token.'
      })
      .output(tokenPresenter)
      .do(async ctx =>
        tokenPresenter.present({
          token: {
            type:
              ctx.auth.type == 'fine_grained'
                ? 'fine_grained_token'
                : ctx.auth.type == 'machine'
                  ? ctx.auth.apiKey
                    ? ctx.auth.apiKey.type
                    : ctx.auth.oauthToken
                      ? 'oauth_access_token'
                      : 'unknown_token'
                  : ctx.auth.type == 'user'
                    ? 'user_auth_token'
                    : 'unknown_token',

            organization:
              'restrictions' in ctx.auth ? ctx.auth.restrictions.organization : undefined,
            instance:
              'restrictions' in ctx.auth && 'instance' in ctx.auth.restrictions
                ? ctx.auth.restrictions.instance
                : undefined,
            actor:
              'restrictions' in ctx.auth && 'actor' in ctx.auth.restrictions
                ? ctx.auth.restrictions.actor
                : undefined,
            user: ctx.auth.type == 'user' ? ctx.auth.user : undefined
          }
        })
      )
  }
);
