import { v } from '@lowerdeck/validation';
import {
  ephemeralManagedSessionService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { ephemeralManagedSessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let ephemeralManagedSessionApp = tenantApp.use(async ctx => {
  let ephemeralManagedSessionId = ctx.body.ephemeralManagedSessionId;
  if (!ephemeralManagedSessionId) {
    throw new Error('EphemeralManagedSession ID is required');
  }

  let ephemeralManagedSession =
    await ephemeralManagedSessionService.getEphemeralManagedSessionById({
      ephemeralManagedSessionId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { ephemeralManagedSession };
});

export let ephemeralManagedSessionController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionTemplateId: v.string(),
        maxSessionDurationInMinutes: v.number({
          modifiers: [v.integer(), v.positive()]
        })
      })
    )
    .do(async ctx => {
      let sessionTemplate = await sessionTemplateService.getSessionTemplateById({
        sessionTemplateId: ctx.input.sessionTemplateId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let ephemeralManagedSession =
        await ephemeralManagedSessionService.createEphemeralManagedSession({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,
          sessionTemplate,
          input: {
            maxSessionDurationInMinutes: ctx.input.maxSessionDurationInMinutes
          }
        });

      return ephemeralManagedSessionPresenter(ephemeralManagedSession);
    }),

  delete: ephemeralManagedSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        ephemeralManagedSessionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let ephemeralManagedSession =
        await ephemeralManagedSessionService.archiveEphemeralManagedSession({
          ephemeralManagedSession: ctx.ephemeralManagedSession,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      return ephemeralManagedSessionPresenter(ephemeralManagedSession);
    })
});
