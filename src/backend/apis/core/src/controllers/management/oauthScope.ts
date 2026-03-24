import { coreScopes, getScopeDefinition, Scope } from '@metorial/module-access';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { oauthScopePermissionsPresenter } from '../../presenters';

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
      .output(oauthScopePermissionsPresenter)
      .do(async () => {
        return oauthScopePermissionsPresenter.present({
          permissions: coreScopes.map(scope => getScopeDefinition(scope as Scope))
        });
      })
  }
);
