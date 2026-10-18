import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import { consumerOAuthAuthorizationPresenter } from '@metorial/presenters';

export let consumerOAuthAuthorizationController = Controller.create(
  {
    name: 'Consumer OAuth Authorization',
    description: 'Inspect and revoke the applications the consumer has authorized.',
    hideInDocs: true
  },
  {
    list: consumerGroup
      .get(consumerPath('oauth/authorizations', 'oauth.authorizations.list'), {
        name: 'List consumer OAuth authorizations',
        description: 'Returns the applications the authenticated consumer has authorized.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.profile:read'] }))
      .outputList(consumerOAuthAuthorizationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'revoked']),
                v.array(v.enumOf(['active', 'revoked']))
              ]),
              { description: 'Filter by authorization status' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await oauthAuthorizationService.listConsumerOAuthAuthorizations({
          consumerProfile: ctx.consumerProfile,
          statuses: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, oauthAuthorization =>
          consumerOAuthAuthorizationPresenter.present({ oauthAuthorization })
        );
      }),

    get: consumerGroup
      .get(
        consumerPath('oauth/authorizations/:oauthAuthorizationId', 'oauth.authorizations.get'),
        {
          name: 'Get consumer OAuth authorization',
          description: 'Returns an application authorization of the authenticated consumer.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.profile:read'] }))
      .output(consumerOAuthAuthorizationPresenter)
      .do(async ctx => {
        let oauthAuthorization =
          await oauthAuthorizationService.getConsumerOAuthAuthorizationById({
            consumerProfile: ctx.consumerProfile,
            oauthAuthorizationId: ctx.params.oauthAuthorizationId
          });

        return consumerOAuthAuthorizationPresenter.present({ oauthAuthorization });
      }),

    revoke: consumerGroup
      .post(
        consumerPath(
          'oauth/authorizations/:oauthAuthorizationId/revoke',
          'oauth.authorizations.revoke'
        ),
        {
          name: 'Revoke consumer OAuth authorization',
          description:
            'Revokes an application authorization of the authenticated consumer, signing the application out.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.profile:read'] }))
      .output(consumerOAuthAuthorizationPresenter)
      .do(async ctx => {
        let oauthAuthorization =
          await oauthAuthorizationService.revokeConsumerOAuthAuthorization({
            consumerProfile: ctx.consumerProfile,
            oauthAuthorizationId: ctx.params.oauthAuthorizationId,
            context: ctx.context
          });

        return consumerOAuthAuthorizationPresenter.present({ oauthAuthorization });
      })
  }
);
