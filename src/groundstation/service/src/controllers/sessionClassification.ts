import { v } from '@lowerdeck/validation';
import { sessionClassificationPresenter } from '../classification/presenter';
import { sessionClassificationService } from '../classification/service';
import { organizationApp } from './_app';

export let sessionClassificationRoutes = {
  review: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        sessionKey: v.string(),

        kind: v.string(),
        action: v.enumOf(['accept', 'reject']),
        entityId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let session = await sessionClassificationService.getSession({
        organization: ctx.organization,
        sessionKey: ctx.input.sessionKey
      });

      let classification = await sessionClassificationService.reviewSession({
        organization: ctx.organization,
        session,
        input: {
          kind: ctx.input.kind,
          action: ctx.input.action,
          entityId: ctx.input.entityId
        }
      });

      return sessionClassificationPresenter({ sessionKey: session._id, classification });
    }),

  reclassify: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), sessionKey: v.string() }))
    .do(async ctx => {
      let session = await sessionClassificationService.getSession({
        organization: ctx.organization,
        sessionKey: ctx.input.sessionKey
      });

      let queued = await sessionClassificationService.reclassifySession({
        organization: ctx.organization,
        session
      });

      return {
        ...sessionClassificationPresenter({
          sessionKey: session._id,
          classification: session.classification
        }),
        queued
      };
    })
};
