import { coreScopes } from '@metorial/module-access';
import { effectiveAccessService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { organizationScopesPresenter } from '@metorial/presenters';

export let scopesController = Controller.create(
  {
    name: 'Scopes',
    description: "Read the current member's effective scopes for this organization"
  },
  {
    get: organizationGroup
      .get(Path('/dashboard/organizations/:organizationId/scopes', 'organizations.scopes.get'), {
        name: 'Get my organization scopes',
        description:
          "Get the effective scopes the current dashboard member has for this organization"
      })
      .use(isDashboardGroup())
      .output(organizationScopesPresenter)
      .do(async ctx => {
        if (ctx.organization.authVersion != 'v2' || !ctx.member) {
          return organizationScopesPresenter.present({ scopes: coreScopes });
        }

        let effectiveAccess = await effectiveAccessService.getMemberEffectiveAccess({
          organization: ctx.organization,
          member: ctx.member
        });

        let scopes = effectiveAccessService.getScopesForTarget({
          effectiveAccess,
          target: { type: 'organization', organization: ctx.organization }
        });

        return organizationScopesPresenter.present({ scopes });
      })
  }
);
