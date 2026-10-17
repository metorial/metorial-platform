import { v } from '@lowerdeck/validation';
import {
  consumerScopes,
  coreScopes,
  getScopeDefinition,
  Scope
} from '@metorial/module-access';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { oauthScopePermissionsPresenter } from '@metorial/presenters';

export let oauthScopeManagementController = Controller.create(
  {
    name: 'OAuth Scope',
    description: 'Read all OAuth scopes that can be requested by organization applications'
  },
  {
    get: organizationGroup
      .get(organizationManagementPath('oauth/scopes', 'oauth.scopes.list'), {
        name: 'List OAuth scopes',
        description:
          'Returns all available OAuth scopes that organization-owned OAuth applications may request.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:read'] }))
      .query(
        'default',
        v.object({
          subject_type: v.optional(
            v.enumOf(['organization_member', 'consumer'], {
              description:
                'Return the scopes available to applications acting as this subject. Defaults to organization_member.'
            })
          )
        })
      )
      .output(oauthScopePermissionsPresenter)
      .do(async ctx => {
        let scopes = ctx.query.subject_type == 'consumer' ? consumerScopes : coreScopes;

        return oauthScopePermissionsPresenter.present({
          permissions: scopes.map(scope => getScopeDefinition(scope as Scope))
        });
      })
  }
);
