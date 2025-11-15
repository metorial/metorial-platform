import { portalWithOptionalAuthApp } from '../middleware/portal';
import { publicApp } from '../middleware/public';
import { authSessionPresenter } from '../presenters/authSession';
import { consumerProfilePresenter } from '../presenters/consumer';
import { portalPresenter } from '../presenters/portal';

export let bootController = publicApp.controller({
  boot: portalWithOptionalAuthApp.handler().do(async ctx => {
    return {
      portal: portalPresenter(ctx.portal),
      consumer: ctx.consumerProfile ? consumerProfilePresenter(ctx.consumerProfile) : null,
      session: ctx.consumerSession ? authSessionPresenter(ctx.consumerSession) : null,
      flags: {}
    };
  })
});
