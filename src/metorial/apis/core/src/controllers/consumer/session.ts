import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAuthService, consumerProfileService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import {
  consumerGroupPresenter,
  consumerProfilePresenter,
  consumerSessionPresenter
} from '../../presenters';

export let consumerSessionController = Controller.create(
  {
    name: 'Consumer Session',
    description: 'Inspect the authenticated consumer session and profile.',
    hideInDocs: true
  },
  {
    getSession: consumerGroup
      .post(consumerPath('session', 'session.get'), {
        name: 'Get consumer session',
        description: 'Returns the authenticated consumer session.',
        confidential: true
      })
      .output(consumerSessionPresenter)
      .do(async ctx => {
        return consumerSessionPresenter.present({
          consumerSession: ctx.consumerSession
        });
      }),

    logout: consumerGroup
      .post(consumerPath('session/logout', 'session.logout'), {
        name: 'Logout consumer session',
        description: 'Revokes the authenticated consumer session.',
        confidential: true
      })
      .output(consumerSessionPresenter)
      .do(async ctx => {
        let consumerSession = await consumerAuthService.revokeConsumerSession({
          session: ctx.consumerSession
        });

        return consumerSessionPresenter.present({
          consumerSession
        });
      }),

    getProfile: consumerGroup
      .post(consumerPath('profile', 'profile.get'), {
        name: 'Get consumer profile',
        description: 'Returns the authenticated consumer profile.',
        confidential: true
      })
      .output(consumerProfilePresenter)
      .do(async ctx => {
        let consumerProfile = await consumerProfileService.getConsumerProfileById({
          consumerSurface: ctx.consumerSurface,
          consumerProfileId: ctx.consumerProfile.id
        });

        return consumerProfilePresenter.present({
          consumerProfile,
          instanceConsumer: consumerProfile.instanceConsumer,
          assignedConsumerGroups: ctx.consumerGroups
        });
      }),

    listGroups: consumerGroup
      .post(consumerPath('profile/groups', 'profile.groups.list'), {
        name: 'List consumer profile groups',
        description: 'Returns the effective groups for the authenticated consumer profile.'
      })
      .outputList(consumerGroupPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        return Paginator.present(
          {
            items: ctx.consumerGroups,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          consumerGroup => consumerGroupPresenter.present({ consumerGroup })
        );
      })
  }
);
