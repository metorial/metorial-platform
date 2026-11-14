import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { env } from '../../../env';
import { tickets } from '../../../lib/tickets';
import { sessionService } from '../../../services/session';
import { publicApp } from '../_app';
import { sessionApp } from '../middleware/session';

export let sessionController = publicApp.controller({
  logout: sessionApp.handler().do(async ({ session, device }) => {
    // An owned session may only be ended by its owner, so the browser is sent there
    // instead. The owner comes back through the internal API to close this session.
    if (session.lifecycleOwner) {
      if (!session.lifecycleOwnerLogoutUrl) {
        throw new ServiceError(
          forbiddenError({
            message: `Session is owned by ${session.lifecycleOwner} and can only be ended there`
          })
        );
      }

      return { type: 'hook', url: session.lifecycleOwnerLogoutUrl };
    }

    let loggedOutSession = await sessionService.logout({ session });

    return {
      type: 'hook',
      url: `${env.service.ARES_AUTH_URL}/metorial-ares/logout/${await tickets.encode({
        type: 'logout',
        deviceId: device.id,
        sessionId: loggedOutSession.id
      })}`
    };
  })
});
