import { base62 } from '@lowerdeck/base62';
import type { IPInfo } from '@lowerdeck/ip-info';
import { UAParser } from 'ua-parser-js';
import type { AuthDevice, AuthDeviceUserSession } from '../../../../prisma/generated/client';

export let sessionPresenter = (
  session: AuthDeviceUserSession & { device: AuthDevice },
  ips: Record<string, IPInfo> = {}
) => {
  let ua = session.device.ua ? new UAParser(session.device.ua).getResult() : null;
  let ip = ips[session.device.ip];

  return {
    object: 'ares#user.session',

    id: session.id,

    status:
      session.loggedOutAt || session.expiresAt < new Date()
        ? ('logged_out' as const)
        : ('active' as const),

    device: {
      object: 'ares#user.session.device',

      id: session.device.id,

      browser: ua?.browser.name,
      os: ua?.os.name,
      country: ip?.country,

      machineId: `mtmac_${base62.encode(session.device.id.slice(-10) + JSON.stringify({ ip, ua }))}`,

      createdAt: session.device.createdAt
    },

    loggedInAt: session.createdAt,
    loggedOutAt: session.loggedOutAt,
    lastActiveAt: session.lastActiveAt
  };
};
