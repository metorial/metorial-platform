import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { oauthAuthorizationInstallationService } from '@metorial/module-machine-access';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { oauthInstallationPresenter } from '@metorial/presenters';

let oauthInstallationManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.oauthInstallationId) {
    throw new ServiceError(
      badRequestError({
        message: 'oauthInstallationId is required'
      })
    );
  }

  let oauthInstallation = await oauthAuthorizationInstallationService.getOAuthInstallationById(
    {
      organization: ctx.organization,
      oauthInstallationId: ctx.params.oauthInstallationId
    }
  );

  return { oauthInstallation };
});

export let oauthInstallationManagementController = Controller.create(
  {
    name: 'OAuth Installation',
    description: 'Inspect and revoke OAuth app installations for an organization'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('oauth/installations', 'oauth.installations.list'), {
        name: 'List organization OAuth installations',
        description: 'Returns a paginated list of OAuth installations for the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_installation:read'] }))
      .outputList(oauthInstallationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'revoked']),
                v.array(v.enumOf(['active', 'revoked']))
              ]),
              { description: 'Filter by installation status' }
            ),
            app_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by OAuth application ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await oauthAuthorizationInstallationService.listOAuthInstallations({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status),
          oauthApplicationIds: normalizeArrayParam(ctx.query.app_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, oauthInstallation =>
          oauthInstallationPresenter.present({ oauthInstallation })
        );
      }),

    get: oauthInstallationManagementGroup
      .get(
        organizationManagementPath(
          'oauth/installations/:oauthInstallationId',
          'oauth.installations.get'
        ),
        {
          name: 'Get organization OAuth installation',
          description: 'Retrieves a specific OAuth installation for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_installation:read'] }))
      .output(oauthInstallationPresenter)
      .do(async ctx => {
        return oauthInstallationPresenter.present({
          oauthInstallation: ctx.oauthInstallation
        });
      }),

    revoke: oauthInstallationManagementGroup
      .post(
        organizationManagementPath(
          'oauth/installations/:oauthInstallationId/revoke',
          'oauth.installations.revoke'
        ),
        {
          name: 'Revoke organization OAuth installation',
          description: 'Revokes a specific OAuth installation for the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_installation:write'] }))
      .output(oauthInstallationPresenter)
      .do(async ctx => {
        let oauthInstallation =
          await oauthAuthorizationInstallationService.revokeOAuthInstallation({
            oauthInstallation: ctx.oauthInstallation,
            performedBy: ctx.actor,
            context: ctx.context
          });

        return oauthInstallationPresenter.present({ oauthInstallation });
      })
  }
);
