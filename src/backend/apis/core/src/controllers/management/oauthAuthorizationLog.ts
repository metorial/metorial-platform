import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { oauthAuthorizationLogService } from '@metorial/module-machine-access';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { oauthAuthorizationLogPresenter } from '../../presenters';

export let oauthAuthorizationLogManagementController = Controller.create(
  {
    name: 'OAuth Authorization Log',
    description: 'Inspect OAuth authorization requests for an organization'
  },
  {
    list: organizationGroup
      .get(
        organizationManagementPath('oauth/authorization-logs', 'oauth.authorizationLogs.list'),
        {
          name: 'List organization OAuth authorization logs',
          description:
            'Returns a paginated list of OAuth authorization requests for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .outputList(oauthAuthorizationLogPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            app_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by OAuth application ID(s)'
            }),
            user_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by user ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await oauthAuthorizationLogService.listOAuthAuthorizationLogs({
          organization: ctx.organization,
          oauthApplicationIds: normalizeArrayParam(ctx.query.app_id),
          userIds: normalizeArrayParam(ctx.query.user_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, oauthAuthorizationLog =>
          oauthAuthorizationLogPresenter.present({ oauthAuthorizationLog })
        );
      })
  }
);
