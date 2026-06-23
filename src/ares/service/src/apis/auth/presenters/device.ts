import type {
  AuthDevice,
  AuthDeviceUserSession,
  User,
  UserEmail
} from '../../../../prisma/generated/client';
import { userPresenter } from './user';

type SessionWithUser = AuthDeviceUserSession & { user: User & { userEmails: UserEmail[] } };

export let devicePresenter = async (
  device: AuthDevice & { sessions: SessionWithUser[] }
) => ({
  object: 'ares#device',

  id: device.id,

  createdAt: device.createdAt,
  updatedAt: device.updatedAt,
  lastActiveAt: device.lastActiveAt,

  sessions: await Promise.all(
    device.sessions.map(async (s: SessionWithUser) => ({
      object: 'ares#device.session',

      id: s.id,

      user: await userPresenter(s.user),

      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      loggedOutAt: s.loggedOutAt
    }))
  )
});

export let deviceLightPresenter = (device: AuthDevice) => ({
  object: 'ares#device(light)',

  id: device.id,

  createdAt: device.createdAt,
  updatedAt: device.updatedAt,
  lastActiveAt: device.lastActiveAt
});
