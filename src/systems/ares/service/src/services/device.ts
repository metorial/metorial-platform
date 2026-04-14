import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { addMinutes, addWeeks } from 'date-fns';
import type {
  App,
  AuthAttempt,
  AuthDevice,
  AuthDeviceUserSession,
  User
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId, snowflake } from '../id';
import type { Context } from '../lib/context';
import { auditLogService } from './auditLog';

class DeviceService {
  async getAllUsersForDevice(d: { device: AuthDevice }) {
    return await db.authDeviceUserSession.findMany({
      where: {
        deviceOid: d.device.oid
      },
      include: {
        user: { include: { userEmails: true } }
      },
      orderBy: {
        id: 'asc'
      }
    });
  }

  async getLoggedInUsersForDevice(d: { device: AuthDevice; app?: App }) {
    return await db.authDeviceUserSession.findMany({
      where: {
        deviceOid: d.device.oid,
        loggedOutAt: null,
        expiresAt: { gte: new Date() },
        ...(d.app ? { appOid: d.app.oid } : {})
      },
      include: {
        user: { include: { userEmails: true } }
      },
      orderBy: {
        id: 'asc'
      }
    });
  }

  async isLoggedInSession(d: { session: AuthDeviceUserSession }) {
    // true if session is logged in
    return !d.session.loggedOutAt && d.session.expiresAt.getTime() > Date.now();
  }

  async getLoggedInAndLoggedOutUsersForDevice(d: { device: AuthDevice; app: App }) {
    let sessions = await db.authDeviceUserSession.findMany({
      where: {
        deviceOid: d.device.oid,
        appOid: d.app.oid
      },
      include: {
        user: { include: { userEmails: true } }
      },
      orderBy: {
        id: 'asc'
      }
    });

    let loggedInSessions = sessions.filter(s => !s.loggedOutAt && s.expiresAt > new Date());
    let loggedOutSessions = sessions.filter(s => s.loggedOutAt || s.expiresAt <= new Date());

    let loggedInUserIds = new Set(loggedInSessions.map(s => s.userOid));
    let seenUserIds = new Set();

    let loggedOutSessionsUnique = loggedOutSessions.filter(s => {
      if (seenUserIds.has(s.userOid)) return false;
      seenUserIds.add(s.userOid);
      return !loggedInUserIds.has(s.userOid);
    });

    return [...loggedInSessions, ...loggedOutSessionsUnique];
  }

  async getSessionForLoggedInUser(d: { user: User; device: AuthDevice; app?: App }) {
    return await db.authDeviceUserSession.findFirst({
      where: {
        userOid: d.user.oid,
        deviceOid: d.device.oid,
        loggedOutAt: null,
        expiresAt: { gte: new Date() },
        ...(d.app ? { appOid: d.app.oid } : {})
      },
      include: {
        user: { include: { userEmails: true } }
      }
    });
  }

  async checkIfUserIsLoggedIn(d: { user: User; device: AuthDevice }) {
    let session = await this.getSessionForLoggedInUser(d);

    return !!session;
  }

  async exchangeAuthAttemptForSession(d: { authAttempt: AuthAttempt }) {
    let authorizationCode = generatePlainId(50);

    let session = await withTransaction(async db => {
      let updateRes = await db.authAttempt.updateMany({
        where: { id: d.authAttempt.id, status: 'pending' },
        data: { status: 'consumed', authorizationCode }
      });
      if (updateRes.count != 1) {
        throw new ServiceError(unauthorizedError({ message: 'Invalid auth attempt' }));
      }

      let [device, user] = await Promise.all([
        db.authDevice.findUniqueOrThrow({
          where: { oid: d.authAttempt.deviceOid }
        }),
        db.user.findUniqueOrThrow({
          where: { oid: d.authAttempt.userOid },
          include: { app: true }
        })
      ]);

      let existingSession = await this.getSessionForLoggedInUser({
        user,
        device
      });
      if (existingSession) return existingSession;

      await db.user.updateMany({
        where: { oid: user.oid },
        data: { lastLoginAt: new Date() }
      });

      auditLogService.log({
        appOid: user.appOid,
        type: 'login',
        userOid: user.oid,
        ip: d.authAttempt.ip,
        ua: d.authAttempt.ua
      });

      return await db.authDeviceUserSession.create({
        data: {
          ...getId('authDeviceUserSession'),
          userOid: user.oid,
          deviceOid: device.oid,
          appOid: user.appOid,
          expiresAt: user.app.isSessionless
            ? addMinutes(new Date(), 1)
            : addWeeks(new Date(), 2)
        }
      });
    });

    return Object.assign(session, { authorizationCode });
  }

  async getDeviceSafe(d: { deviceId: string; deviceClientSecret: string }) {
    return await db.authDevice.findFirst({
      where: {
        id: d.deviceId,
        clientSecret: d.deviceClientSecret
      }
    });
  }

  async getDevice(d: { deviceId: string; deviceClientSecret: string }) {
    let device = await this.getDeviceSafe(d);
    if (!device) {
      throw new ServiceError(unauthorizedError({ message: 'Uninitialized device' }));
    }

    return device;
  }

  async useDevice(d: { deviceId: string; deviceClientSecret: string; context: Context }) {
    let device = await this.getDevice(d);
    await this.recordDeviceUse({
      device,
      context: d.context
    });
    return device;
  }

  async dangerouslyGetDeviceOnlyById(d: { deviceId: string }) {
    let device = await db.authDevice.findFirst({
      where: { id: d.deviceId }
    });
    if (!device) {
      throw new ServiceError(unauthorizedError({ message: 'Uninitialized device' }));
    }

    return device;
  }

  async ensureDevice(d: { deviceId?: string; deviceClientSecret?: string; context: Context }) {
    let device =
      d.deviceClientSecret && d.deviceId
        ? await this.getDeviceSafe({
            deviceId: d.deviceId,
            deviceClientSecret: d.deviceClientSecret
          })
        : undefined;

    if (!device) {
      device = await this.createDevice({
        context: d.context
      });
    }

    await this.recordDeviceUse({
      device,
      context: d.context
    });
    return device;
  }

  async listUserSessions(d: { user: User }) {
    let sessions = await db.authDeviceUserSession.findMany({
      where: {
        userOid: d.user.oid
      },
      include: {
        device: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    return sessions;
  }

  async createDevice(d: { context: Context }) {
    return await db.authDevice.create({
      data: {
        ...getId('authDevice'),
        clientSecret: getId('authDevice').id,

        ip: d.context.ip,
        ua: d.context.ua,

        lastIp: d.context.ip,
        lastUa: d.context.ua,

        history: {
          create: {
            id: snowflake.nextId(),
            ip: d.context.ip,
            ua: d.context.ua
          }
        }
      }
    });
  }

  async recordDeviceUse(d: {
    device: AuthDevice;
    context: Context;
    session?: AuthDeviceUserSession;
  }) {
    let updateHistory = false;
    let updateDeviceLastActiveAt = false;
    let updateSessionLastActiveAt = false;
    let bumpSession = false;

    if (
      !d.device.lastActiveAt ||
      Date.now() - d.device.lastActiveAt.getTime() > 1000 * 60 * 60
    ) {
      updateDeviceLastActiveAt = true;
    }

    if (d.device.lastIp != d.context.ip || d.device.lastUa != d.context.ua) {
      updateHistory = true;
    }

    if (d.session) {
      if (d.session.expiresAt.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 5) {
        bumpSession = true;
      }

      if (
        !d.session.lastActiveAt ||
        Date.now() - d.session.lastActiveAt.getTime() > 1000 * 60 * 60
      ) {
        updateSessionLastActiveAt = true;
      }
    }

    if (
      bumpSession ||
      updateHistory ||
      updateDeviceLastActiveAt ||
      updateSessionLastActiveAt
    ) {
      await db.authDevice.updateMany({
        where: { id: d.device.id },
        data: {
          lastIp: d.context.ip,
          lastUa: d.context.ua,
          lastActiveAt: new Date()
        }
      });

      if (updateHistory) {
        await db.authDeviceHistory.create({
          data: {
            id: snowflake.nextId(),
            deviceOid: d.device.oid,
            ip: d.context.ip,
            ua: d.context.ua
          }
        });
      }

      if (d.session) {
        if (bumpSession) {
          let app = await db.app.findUnique({
            where: { oid: d.session.appOid }
          });

          if (!app?.isSessionless) {
            await db.authDeviceUserSession.updateMany({
              where: { id: d.session.id },
              data: { expiresAt: addWeeks(new Date(), 2) }
            });
          }
        }

        if (updateSessionLastActiveAt) {
          await db.user.updateMany({
            where: { oid: d.session.userOid },
            data: { lastActiveAt: new Date() }
          });

          await db.authDeviceUserSession.update({
            where: { id: d.session.id },
            data: { lastActiveAt: new Date() }
          });
        }
      }

      return true;
    }

    return false;
  }
}

export let deviceService = new DeviceService();
