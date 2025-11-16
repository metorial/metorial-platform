import { badRequestError, ServiceError } from '@metorial/error';
import { ssoUserService } from '@metorial/module-sso';
import { Controller } from '@metorial/rest';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import {
  consumerProfilePresenter,
  consumerSessionPresenter,
  ssoUserPresenter
} from '../../presenters';

export let consumerSessionController = Controller.create(
  {
    name: 'Consumer Session',
    description: '',
    hideInDocs: true
  },
  {
    getSession: consumerGroup
      .post(consumerPath('session', 'session.get'), { name: '', description: '' })
      .output(consumerSessionPresenter)
      .do(async ctx => {
        return consumerSessionPresenter.present({
          consumerSession: ctx.consumerSession
        });
      }),

    getProfile: consumerGroup
      .post(consumerPath('profile', 'profile.get'), { name: '', description: '' })
      .output(consumerProfilePresenter)
      .do(async ctx => {
        return consumerProfilePresenter.present({
          consumerProfile: ctx.consumerProfile
        });
      }),

    getSsoUser: consumerGroup
      .post(consumerPath('profile/sso-user', 'profile.ssoUser.get'), {
        name: '',
        description: ''
      })
      .output(ssoUserPresenter)
      .do(async ctx => {
        if (!ctx.consumerProfile.ssoUser) {
          throw new ServiceError(
            badRequestError({
              message: 'Consumer profile is not linked to an SSO user'
            })
          );
        }

        let ssoUser = await ssoUserService.DANGEROUSLY_getSsoUserById({
          ssoUserId: ctx.consumerProfile.ssoUser.id
        });

        return ssoUserPresenter.present({
          ssoUser
        });
      })
  }
);
