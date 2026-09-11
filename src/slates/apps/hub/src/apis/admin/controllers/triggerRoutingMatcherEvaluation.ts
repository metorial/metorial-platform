import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { triggerRoutingMatcherEvaluationPresenter } from '../../../presenters';
import { triggerRoutingMatcherEvaluationService } from '../../../services';
import { webhookApp } from './webhook';

export let triggerRoutingMatcherEvaluationController = webhookApp.controller({
  list: webhookApp
    .handler()
    .input(Paginator.validate(v.object({ webhookRegistrationId: v.string() })))
    .do(async ctx => {
      let paginator = await triggerRoutingMatcherEvaluationService.listMatcherEvaluations({
        webhookRegistration: ctx.webhookRegistration
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, triggerRoutingMatcherEvaluationPresenter);
    })
});
