import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { Controller } from '@metorial/rest';
import { pageAuthorizations } from '../../lib/authorizationPaging';
import {
  getConsumerAuthorization,
  listConsumerAuthorizations,
  revokeConsumerAuthorization
} from '../../lib/consumerOAuthAuthorizations';
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
        let statuses = normalizeArrayParam(ctx.query.status);
        let list = await Paginator.create(({ externalCursor }) =>
          externalCursor(async page =>
            pageAuthorizations(
              await listConsumerAuthorizations({
                consumerProfile: ctx.consumerProfile,
                statuses
              }),
              page
            )
          )
        ).run(ctx.query);

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
        let oauthAuthorization = await getConsumerAuthorization({
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
        let oauthAuthorization = await revokeConsumerAuthorization({
          consumerProfile: ctx.consumerProfile,
          oauthAuthorizationId: ctx.params.oauthAuthorizationId,
          context: ctx.context
        });

        return consumerOAuthAuthorizationPresenter.present({ oauthAuthorization });
      })
  }
);
