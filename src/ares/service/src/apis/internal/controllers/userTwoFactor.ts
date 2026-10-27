import { v } from '@lowerdeck/validation';
import { userTwoFactorService } from '../../../services/userTwoFactor';
import { internalApp } from '../_app';

let identity = { appId: v.string(), userId: v.string() };

let context = v.object({ ip: v.string(), ua: v.string() });

export let userTwoFactorController = internalApp.controller({
  get: internalApp
    .handler()
    .input(v.object(identity))
    .do(({ input }) => userTwoFactorService.get(input)),

  startSetup: internalApp
    .handler()
    .input(
      v.object({
        ...identity,
        sessionId: v.string(),
        method: v.optional(v.enumOf(['totp', 'passkey'])),
        callbackUrl: v.string(),
        returnUrl: v.string(),
        expiresAt: v.date(),
        context
      })
    )
    .do(({ input }) => userTwoFactorService.startSetup(input)),

  finalize: internalApp
    .handler()
    .input(v.object({ ...identity, sessionId: v.string(), setupId: v.string(), context }))
    .do(({ input }) => userTwoFactorService.finalize(input)),

  remove: internalApp
    .handler()
    .input(v.object({ ...identity, factorId: v.optional(v.string()), context }))
    .do(({ input }) => userTwoFactorService.remove(input))
});
