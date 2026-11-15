import { v } from '@lowerdeck/validation';
import { ssoElevationService } from '../../../../services/sso/elevation';
import { internalApp } from '../../_app';

export let ssoElevationController = internalApp.controller({
  listOptions: internalApp
    .handler()
    .input(v.object({ userId: v.string() }))
    .do(async ({ input }) => ({
      connections: await ssoElevationService.listOptions({ userId: input.userId })
    })),

  create: internalApp
    .handler()
    .input(
      v.object({
        userId: v.string(),
        tenantId: v.string(),
        connectionId: v.string(),
        redirectUri: v.string({ modifiers: [v.url()] })
      })
    )
    .do(async ({ input }) => await ssoElevationService.create(input)),

  complete: internalApp
    .handler()
    .input(
      v.object({
        userId: v.string(),
        tenantId: v.string(),
        authId: v.string(),
        context: v.object({ ip: v.string(), ua: v.string() })
      })
    )
    .do(async ({ input }) => await ssoElevationService.complete(input))
});
