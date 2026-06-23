import { createCachedFunction } from '@lowerdeck/cache';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuthDevice, AuthDeviceUserSession, User } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import type { Context } from '../lib/context';
import { auditLogService } from './auditLog';
import { deviceService } from './device';

let cacheTTLSecs = 60 * 5;
let findAuthSessionCached = createCachedFunction<
  { sessionId: string },
  { device: AuthDevice; session: AuthDeviceUserSession; user: User } | null
>({
  name: 'authenticate',
  redisUrl: env.service.REDIS_URL,
  provider: async (i, { setTTL }) => {
    let session = await db.authDeviceUserSession.findUnique({
      where: {
        id: i.sessionId,
        loggedOutAt: null,
        expiresAt: { gte: new Date() }
      },
      include: {
        device: true,
        user: {
          include: { userEmails: true }
        }
      }
    });

    let user = session?.user;
    let device = session?.device;
    if (!session || !device || !user) return null;

    if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > 1000 * 60 * 30) {
      user = await db.user.update({
        where: { oid: user.oid },
        data: { lastActiveAt: new Date() },
        include: { userEmails: true }
      });
    }

    return { device, session, user };
  },
  getHash: i => `1:${i.sessionId}`,
  getTags: o => (o ? [o.user.id] : []),
  ttlSeconds: cacheTTLSecs
});

class SessionService {
  async clearCache(user: User) {
    return findAuthSessionCached.clearByTag(user.id);
  }

  async authenticate(d: {
    deviceId: string;
    deviceClientSecret: string;
    sessionId: string;
    context: Context;
  }) {
    let res = await findAuthSessionCached(d);

    if (
      !res ||
      res.device.id != d.deviceId ||
      res.device.clientSecret != d.deviceClientSecret ||
      res.session.expiresAt < new Date()
    )
      return null;

    let changed = await deviceService.recordDeviceUse({
      context: d.context,
      device: res.device,
      session: res.session
    });
    if (changed) findAuthSessionCached.clear(d);

    return res;
  }

  async logout(d: { session: AuthDeviceUserSession }) {
    let res = await db.authDeviceUserSession.update({
      where: {
        id: d.session.id
      },
      data: {
        loggedOutAt: new Date(),
        expiresAt: new Date()
      },
      include: { device: true, user: true }
    });

    auditLogService.log({
      appOid: res.user.appOid,
      type: 'logout',
      userOid: res.user.oid,
      ip: res.device.lastIp,
      ua: res.device.lastUa
    });

    await findAuthSessionCached.clear({
      sessionId: d.session.id
    });

    return res;
  }

  async getSessionSafe(d: { sessionId: string }) {
    return db.authDeviceUserSession.findUnique({
      where: { id: d.sessionId },
      include: { device: true, user: true }
    });
  }

  async getUserSession(d: { user: User; sessionId: string }) {
    let session = await db.authDeviceUserSession.findFirst({
      where: { id: d.sessionId, userOid: d.user.oid },
      include: { device: true, user: true }
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionId));

    return session;
  }

  async findAdminForSession(d: { session: AuthDeviceUserSession & { user: User } }) {
    let admin = await db.admin.findUnique({
      where: { email: d.session.user.email }
    });
    return admin;
  }

  async upsertDevAdminSession(d: { session: AuthDeviceUserSession & { user: User } }) {
    if (process.env.NODE_ENV != 'development') {
      throw new Error('NOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO');
    }

    let existingAdmin = await db.admin.findUnique({
      where: { email: d.session.user.email }
    });
    if (existingAdmin) return existingAdmin;

    return await db.admin.upsert({
      where: { email: d.session.user.email },
      create: {
        email: d.session.user.email,
        name: d.session.user.name,
        ...getId('admin'),
        password: ''
      },
      update: {}
    });
  }
}

export let sessionService = Service.create(
  'SessionService',
  () => new SessionService()
).build();
