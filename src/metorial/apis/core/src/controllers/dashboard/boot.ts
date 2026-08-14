import { v } from '@lowerdeck/validation';
import { consumerProfileService } from '@metorial/module-consumer';
import { organizationService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { userGroup } from '../../middleware/userGroup';
import { bootPresenter } from '@metorial/presenters';

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

        let consumers = await consumerProfileService.getConsumersForUser({
          user: ctx.user
        });

        return bootPresenter.present({
          ...res,
          consumers
        });
      })
  }
);
