import { env } from '../../../env';
import { tickets } from '../../../lib/tickets';
import { sessionService } from '../../../services/session';
import { publicApp } from '../_app';
import { sessionApp } from '../middleware/session';

export let sessionController = publicApp.controller({
  logout: sessionApp.handler().do(async ({ session, device }) => {
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
