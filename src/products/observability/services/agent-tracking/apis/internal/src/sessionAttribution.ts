import { v } from '@lowerdeck/validation';
import { sessionAttributionService } from '@mtsrc/agent-tracking-module-sessions';
import { sessionAttributionPresenter } from './presenters/sessionAttribution';
import { organizationApp } from './_app';

export let sessionAttributionRoutes = {
  assign: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        sessionKey: v.string(),
        kind: v.string(),
        entityId: v.nullable(v.string())
      })
    )
    .do(async ctx => {
      let session = await sessionAttributionService.assignSession({
        organization: ctx.organization,
        sessionKey: ctx.input.sessionKey,
        kind: ctx.input.kind,
        entityId: ctx.input.entityId
      });

      return sessionAttributionPresenter(session);
    })
};
