import { v } from '@lowerdeck/validation';
import { consumerProfileService } from '@metorial/module-consumer-core';
import { organizationService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { userOrConsumerGroup } from '../../middleware/userGroup';
import { bootPresenter } from '@metorial/presenters';

export let dashboardBootController = Controller.create(
  {
    name: 'Boot',
    description: 'Boot user'
  },
  {
    boot: userOrConsumerGroup
      .post(Path('/dashboard/boot', 'dashboard.boot'), {
        name: 'Create organization',
        description: 'Create a new organization'
      })
      .body('default', v.object({}))
      .output(bootPresenter)
      .do(async ctx => {
        if (ctx.consumerProfile) {
          let res = await organizationService.bootConsumer({
            consumerProfile: ctx.consumerProfile,
            user: ctx.user
          });

          let consumers = await consumerProfileService.getConsumersForUser({
            user: ctx.user,
            consumerSurface: ctx.consumerSurface
          });

          return bootPresenter.present({
            ...res,
            consumers
          });
        }

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
