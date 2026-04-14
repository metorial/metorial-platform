import { v } from '@lowerdeck/validation';
import { deviceService } from '../../../services/device';
import { publicApp } from '../_app';
import { resolveApp } from '../lib/resolveApp';
import { deviceApp } from '../middleware/device';
import { deviceUserPresenter } from '../presenters';

export let deviceController = publicApp.controller({
  ensure: publicApp
    .handler()
    .input(
      v.object({
        deviceId: v.optional(v.string()),
        clientSecret: v.optional(v.string())
      })
    )
    .do(async ({ input, context }) => {
      let device =
        input.deviceId && input.clientSecret
          ? await deviceService.getDeviceSafe({
              deviceId: input.deviceId,
              deviceClientSecret: input.clientSecret
            })
          : null;

      if (!device) {
        device = await deviceService.createDevice({
          context: {
            ip: context.ip,
            ua: context.ua ?? ''
          }
        });
      }

      return {
        deviceId: device.id,
        clientSecret: device.clientSecret
      };
    }),

  getLoggedInUsers: deviceApp
    .handler()
    .input(
      v.object({
        clientId: v.string(),
        deviceId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ({ device, input }) => {
      let app = await resolveApp(input.clientId);

      let sessions = await deviceService.getLoggedInUsersForDevice({
        device,
        app
      });

      return await Promise.all(sessions.map(deviceUserPresenter));
    })
});
