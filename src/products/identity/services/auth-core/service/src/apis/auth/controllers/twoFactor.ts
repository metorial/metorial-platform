import { v } from '@lowerdeck/validation';
import { userTwoFactorService } from '../../../services/userTwoFactor';
import { authService } from '../../../services/auth';
import { deviceApp } from '../middleware/device';
import { authIntentApp } from '../middleware/authIntent';
import { authIntentPresenter } from '../presenters';
import { publicApp } from '../_app';

let text = () => v.string({ modifiers: [v.maxLength(16384)] });

let setupIdentity = {
  setupId: v.string(),
  clientSecret: v.string({ modifiers: [v.maxLength(256)] })
};

let intentIdentity = {
  authIntentId: v.string(),
  clientSecret: v.string(),
  stepId: v.string()
};

let credential = {
  id: text(),
  rawId: text(),
  type: v.literal('public-key'),
  authenticatorAttachment: v.optional(v.enumOf(['platform', 'cross-platform'])),
  clientExtensionResults: v.object({
    credProps: v.optional(v.object({ rk: v.optional(v.boolean()) }))
  })
};

export let twoFactorController = publicApp.controller({
  getSetup: deviceApp
    .handler()
    .input(v.object(setupIdentity))
    .do(({ input, device }) =>
      userTwoFactorService.getSetup({ ...input, deviceId: device.id })
    ),

  confirmTotp: deviceApp
    .handler()
    .input(v.object({ ...setupIdentity, code: v.string({ modifiers: [v.maxLength(6)] }) }))
    .do(({ input, device }) =>
      userTwoFactorService.confirmTotp({ ...input, deviceId: device.id })
    ),

  registrationOptions: deviceApp
    .handler()
    .input(v.object(setupIdentity))
    .do(({ input, device }) =>
      userTwoFactorService.registrationOptions({ ...input, deviceId: device.id })
    ),

  confirmPasskey: deviceApp
    .handler()
    .input(
      v.object({
        ...setupIdentity,
        name: v.string({ modifiers: [v.maxLength(100)] }),
        response: v.object({
          ...credential,
          response: v.object({
            clientDataJSON: text(),
            attestationObject: text(),
            transports: v.optional(v.array(text())),
            publicKeyAlgorithm: v.optional(v.number()),
            publicKey: v.optional(text()),
            authenticatorData: v.optional(text())
          })
        })
      })
    )
    .do(({ input, device }) =>
      userTwoFactorService.confirmPasskey({ ...input, deviceId: device.id })
    ),

  takeRecoveryCodes: deviceApp
    .handler()
    .input(v.object(setupIdentity))
    .do(({ input, device }) =>
      userTwoFactorService.takeRecoveryCodes({ ...input, deviceId: device.id })
    ),

  cancel: deviceApp
    .handler()
    .input(v.object(setupIdentity))
    .do(({ input, device }) => userTwoFactorService.cancel({ ...input, deviceId: device.id })),

  loginOptions: authIntentApp
    .handler()
    .input(v.object(intentIdentity))
    .do(({ input }) => userTwoFactorService.loginOptions(input)),

  authenticationOptions: authIntentApp
    .handler()
    .input(v.object(intentIdentity))
    .do(({ input }) => userTwoFactorService.authenticationOptions(input)),

  verify: authIntentApp
    .handler()
    .input(
      v.object({
        ...intentIdentity,
        input: v.union([
          v.object({
            type: v.enumOf(['totp', 'recovery_code']),
            code: v.string({ modifiers: [v.maxLength(100)] })
          }),
          v.object({
            type: v.literal('passkey'),
            response: v.object({
              ...credential,
              response: v.object({
                clientDataJSON: text(),
                authenticatorData: text(),
                signature: text(),
                userHandle: v.optional(text())
              })
            })
          })
        ])
      })
    )
    .do(async ({ input, context }) => {
      await userTwoFactorService.verifyLogin({
        ...input,
        context: { ip: context.ip, ua: context.ua ?? '' }
      });
      return authIntentPresenter(await authService.getAuthIntent(input));
    })
});
