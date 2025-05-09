import { organizationService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { userGroup } from '../../middleware/userGroup';
import { bootPresenter } from '../../presenters';

export let dashboardBootController = Controller.create(
  {
    name: 'Boot',
    description: 'Boot user'
  },
  {
    boot: userGroup
      .use(isDashboardGroup())
      .post(Path('/dashboard/boot', 'dashboard.boot'), {
        name: 'Create organization',
        description: 'Create a new organization'
      })
      .body('default', v.object({}))
      .output(bootPresenter)
      .do(async ctx => {
        let res = await organizationService.bootUser({
          user: ctx.user
        });

        return bootPresenter.present(res);
      })
  }
);
