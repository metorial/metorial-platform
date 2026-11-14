import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { sessionService } from '../../../services/session';
import { publicApp } from '../_app';
import {
  extractDeviceInfo,
  parseDeviceToken,
  SESSION_ID_COOKIE_NAME,
  setSessionCookie
} from './device';

let transferredSessionInfoValidator = v.object({
  sessionId: v.string(),
  deviceToken: v.string(),
  context: v.object({
    ip: v.string(),
    ua: v.optional(v.nullable(v.string()))
  })
});

export let authApp = publicApp.use(async ctx => {
  let transferredSessionInfo = ctx.query.get('__metorial_transferred_session_info');
  if (transferredSessionInfo) {
    let parsed = transferredSessionInfoValidator.validate(JSON.parse(transferredSessionInfo));
    if (parsed.success) {
      let token = parseDeviceToken(parsed.value.deviceToken);

      if (token) {
        let session = await sessionService.authenticate({
          sessionId: parsed.value.sessionId,
          context: {
            ip: parsed.value.context.ip,
            ua: parsed.value.context.ua ?? ''
          },
          ...token
        });
        if (!session) {
          throw new ServiceError(unauthorizedError({ message: 'Not authenticated' }));
        }

        return session;
      }
    }
  }

  let deviceInfo = extractDeviceInfo(ctx);
  let sessionId = ctx.getCookie(SESSION_ID_COOKIE_NAME);

  if (sessionId && deviceInfo) {
    let session = await sessionService.authenticate({
      sessionId,
      context: {
        ip: ctx.context.ip,
        ua: ctx.context.ua ?? ''
      },

      deviceId: deviceInfo.deviceId,
      deviceClientSecret: deviceInfo.deviceClientSecret
    });
    if (!session) {
      throw new ServiceError(unauthorizedError({ message: 'Not authenticated' }));
    }

    setSessionCookie(ctx, sessionId);

    return session;
  }

  throw new ServiceError(unauthorizedError({ message: 'Not authenticated' }));
});
