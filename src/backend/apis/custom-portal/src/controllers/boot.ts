import { consumerAuthService } from '@metorial/module-consumer';
import { portalWithAuthApp, portalWithOptionalAuthApp } from '../middleware/portal';
import { publicApp } from '../middleware/public';
import { authSessionPresenter } from '../presenters/authSession';
import { consumerProfilePresenter } from '../presenters/consumer';
import { portalPresenter } from '../presenters/portal';

export let bootController = publicApp.controller({
  boot: portalWithOptionalAuthApp.handler().do(async ctx => {
    let core = {
      portal: await portalPresenter(ctx.portal),
      flags: {}
    };

    if (ctx.consumerProfile) {
      let consumerSessionToken = await consumerAuthService.getConsumerToken({
        session: ctx.consumerSession,
        surface: ctx.surface
      });
      let portalSessionToken = await consumerAuthService.getPortalToken({
        session: ctx.consumerSession,
        surface: ctx.surface
      });

      return {
        type: 'authenticated' as const,

        consumer: consumerProfilePresenter(ctx.consumerProfile),
        session: authSessionPresenter(ctx.consumerSession),

        portalSessionToken,
        consumerSessionToken,

        ...core
      };
    }

    return {
      type: 'unauthenticated' as const,

      ...core
    };
  }),

  getTokens: portalWithAuthApp.handler().do(async ctx => {
    let consumerSessionToken = await consumerAuthService.getConsumerToken({
      session: ctx.consumerSession,
      surface: ctx.surface
    });
    let portalSessionToken = await consumerAuthService.getPortalToken({
      session: ctx.consumerSession,
      surface: ctx.surface
    });

    return {
      consumer: consumerProfilePresenter(ctx.consumerProfile),
      session: authSessionPresenter(ctx.consumerSession),

      portalSessionToken,
      consumerSessionToken
    };
  })
});
