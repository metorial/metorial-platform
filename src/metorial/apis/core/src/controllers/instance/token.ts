import { Controller, Path } from '@metorial/rest';
import { apiGroup } from '../../middleware/apiGroup';
import { tokenPresenter } from '@metorial/presenters';

export let tokenController = Controller.create(
  {
    name: 'Token',
    description:
      'A token is the credential a request authenticates with. This resource describes the calling token’s type and scope.',
    hideInDocs: true
  },
  {
    get: apiGroup
      .get(Path('token', 'token.get'), {
        name: 'Get token',
        description: 'Retrieves metadata about the calling token.',
        confidential: true
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
