import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { sessionService } from '../../../services/session';
import { publicApp } from '../_app';
import { extractDeviceInfo, SESSION_ID_COOKIE_NAME, setSessionCookie } from './device';

export let sessionApp = publicApp.use(async ctx => {
  let deviceInfo = extractDeviceInfo(ctx);

  let sessionId = ctx.getCookie(SESSION_ID_COOKIE_NAME);

  if (!sessionId || !deviceInfo) {
    throw new ServiceError(unauthorizedError({ message: 'Not authenticated' }));
  }

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
});
