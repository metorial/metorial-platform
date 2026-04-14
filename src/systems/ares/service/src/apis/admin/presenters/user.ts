import type {
  AuthAttempt,
  AuthDevice,
  AuthDeviceUserSession,
  User,
  UserEmail
} from '../../../../prisma/generated/client';
import { deletedEmail } from '../../../lib/deletedEmail';
import { getImageUrl } from '../../../lib/getImageUrl';

export let adminUserPresenter = async (
  user: User & {
    userEmails: UserEmail[];
    authDeviceUserSessions: (AuthDeviceUserSession & { device: AuthDevice })[];
    authAttempts: AuthAttempt[];
  }
) => ({
  object: 'ares#user' as const,

  status: user.deletedAt ? 'deleted' : 'active',

  id: user.id,

  email: user.deletedAt ? deletedEmail.restoreAnonymized(user.email) : user.email,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,

  lastLoginAt: user.lastLoginAt,
  lastActiveAt: user.lastActiveAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,

  imageUrl: await getImageUrl(user),

  emails: user.userEmails.map(e => ({
    id: e.id,
    email: e.email,
    isPrimary: e.isPrimary,
    verifiedAt: e.verifiedAt,
    createdAt: e.createdAt
  })),

  sessions: user.authDeviceUserSessions.map(s => ({
    id: s.id,
    loggedOutAt: s.loggedOutAt,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    device: {
      id: s.device.id,
      ip: s.device.ip,
      ua: s.device.ua
    }
  })),

  authAttempts: user.authAttempts.map(a => ({
    id: a.id,
    status: a.status,
    ip: a.ip,
    ua: a.ua,
    createdAt: a.createdAt
  }))
});
