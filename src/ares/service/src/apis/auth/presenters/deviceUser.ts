import type { AuthDeviceUserSession, User, UserEmail } from '../../../../prisma/generated/client';
import { userPresenter } from './user';

export let deviceUserPresenter = async (
  deviceUser: AuthDeviceUserSession & { user: User & { userEmails: UserEmail[] } }
) => ({
  object: 'ares#device.user',

  id: deviceUser.id,
  userId: deviceUser.user.id,
  loggedInAt: deviceUser.createdAt,
  loggedOutAt: deviceUser.loggedOutAt,
  lastActiveAt: deviceUser.lastActiveAt,
  status:
    deviceUser.loggedOutAt || (deviceUser.expiresAt && deviceUser.expiresAt < new Date())
      ? ('logged_out' as const)
      : ('active' as const),

  user: await userPresenter(deviceUser.user)
});
