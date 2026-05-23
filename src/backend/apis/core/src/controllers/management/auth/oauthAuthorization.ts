import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { oauthAuthorizationPresenter } from '../../../presenters';

let oauthAuthorizationManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.oauthAuthorizationId) {
    throw new ServiceError(
      badRequestError({
        message: 'oauthAuthorizationId is required'
      })
    );
  }

  let oauthAuthorization = await oauthAuthorizationService.getOAuthAuthorizationById({
    organization: ctx.organization,
    oauthAuthorizationId: ctx.params.oauthAuthorizationId
  });

  return { oauthAuthorization };
});

export let oauthAuthorizationManagementController = Controller.create(
  {
    name: 'OAuth Authorization',
    description: 'Inspect and revoke OAuth authorizations for an organization'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('oauth/authorizations', 'oauth.authorizations.list'), {
        name: 'List organization OAuth authorizations',
        description: 'Returns a paginated list of OAuth authorizations for the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .outputList(oauthAuthorizationPresenter)
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
            ),
            installation_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by installation ID(s)'
            }),
            app_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by OAuth application ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await oauthAuthorizationService.listOAuthAuthorizations({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status),
          oauthInstallationIds: normalizeArrayParam(ctx.query.installation_id),
          oauthApplicationIds: normalizeArrayParam(ctx.query.app_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, oauthAuthorization =>
          oauthAuthorizationPresenter.present({ oauthAuthorization })
        );
      }),

    get: oauthAuthorizationManagementGroup
      .get(
        organizationManagementPath(
          'oauth/authorizations/:oauthAuthorizationId',
          'oauth.authorizations.get'
        ),
        {
          name: 'Get organization OAuth authorization',
          description: 'Retrieves a specific OAuth authorization for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .output(oauthAuthorizationPresenter)
      .do(async ctx => {
        return oauthAuthorizationPresenter.present({
          oauthAuthorization: ctx.oauthAuthorization
        });
      }),

    revoke: oauthAuthorizationManagementGroup
      .post(
        organizationManagementPath(
          'oauth/authorizations/:oauthAuthorizationId/revoke',
          'oauth.authorizations.revoke'
        ),
        {
          name: 'Revoke organization OAuth authorization',
          description: 'Revokes a specific OAuth authorization for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:write'] }))
      .output(oauthAuthorizationPresenter)
      .do(async ctx => {
        let oauthAuthorization = await oauthAuthorizationService.revokeOAuthAuthorization({
          oauthAuthorization: ctx.oauthAuthorization,
          performedBy: ctx.actor,
          context: ctx.context
        });

        return oauthAuthorizationPresenter.present({ oauthAuthorization });
      })
  }
);
