import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateErrorFullPresenter, slateErrorLitePresenter } from '../../presenters/slateError';
import { slateErrorService } from '../../services/slateError';
import { tenantService } from '../../services/tenant';
import { app } from './_app';

export let slateErrorController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          types: v.optional(
            v.array(
              v.enumOf([
                'tool_call_failed',
                'config_validation_failed',
                'auth_processing_failed',
                'oauth_token_refresh_failed',
                'oauth_setup_failed',
                'trigger_event_input_failed',
                'profile_fetch_failed'
              ])
            )
          )
        })
      )
    )
    .do(async ctx => {
      let tenant = ctx.input.tenantId
        ? await tenantService.getTenantById({ id: ctx.input.tenantId })
        : undefined;

      let paginator = await slateErrorService.listSlateErrors({
        tenant,
        types: ctx.input.types
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slateErrorLitePresenter);
    }),

  get: app
    .handler()
    .input(
      v.object({
        slateErrorId: v.string(),
        tenantId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let tenant = ctx.input.tenantId
        ? await tenantService.getTenantById({ id: ctx.input.tenantId })
        : undefined;

      let error = await slateErrorService.getSlateError({
        id: ctx.input.slateErrorId,
        tenant
      });

      return await slateErrorFullPresenter(error);
    })
});
