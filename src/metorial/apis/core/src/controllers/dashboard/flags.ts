import { flagService } from '@metorial/module-flags';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { flagsPresenter } from '@metorial/presenters';

export let flagsController = Controller.create(
  {
    name: 'Flags',
    description: 'Read feature flags for the current organization and user'
  },
  {
    get: organizationGroup
      .get(Path('/dashboard/organizations/:organizationId/flags', 'organizations.flags.get'), {
        name: 'Get flags',
        description: 'Get feature flags for the current organization and user'
      })
      .use(isDashboardGroup())
      .output(flagsPresenter)
      .do(async ctx => {
        let flags = await flagService.getFlags({
          organization: ctx.organization,
          user: ctx.auth.type === 'user' ? ctx.auth.user : undefined!
        });

        return flagsPresenter.present({ flags });
      })
  }
);
