import { createCachedFunction } from '@lowerdeck/cache';
import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuthDevice, AuthDeviceUserSession, User } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import type { Context } from '../lib/context';
import { auditLogService } from './auditLog';
import { deviceService } from './device';
import { markAresUserChanged } from '../queues/syncCallback';

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
      await markAresUserChanged({ userId: user.id });
    }

    return { device, session, user };
  },
  getHash: i => `1:${i.sessionId}`,
  getTags: o => (o ? [o.user.id] : []),
  ttlSeconds: cacheTTLSecs
});

export type SessionLifecycleState =
  | 'active'
  | 'superseded'
  | 'logged_out'
  | 'expired'
  | 'revoked';

export let SESSION_LIFECYCLE_STATES: [SessionLifecycleState, ...SessionLifecycleState[]] = [
  'active',
  'superseded',
  'logged_out',
  'expired',
  'revoked'
];

let TERMINAL_LIFECYCLE_STATES = new Set<SessionLifecycleState>([
  'logged_out',
  'expired',
  'revoked'
]);

export type ApplyOwnerStateResult =
  | { applied: true }
  | {
      applied: false;
      reason: 'owned_by_other' | 'stale_owner_session' | 'stale_revision' | 'session_closed';
    };

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

  async logout(d: { session: AuthDeviceUserSession; owner?: string }) {
    if (d.session.lifecycleOwner && d.session.lifecycleOwner !== d.owner) {
      throw new ServiceError(
        forbiddenError({
          message: `Session is owned by ${d.session.lifecycleOwner} and can only be ended there`
        })
      );
    }

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

  // The owner claims a session by pushing its first state and keeps it by pushing
  // every later one. Claiming is scoped to the app it names, so an owner of the main
  // app can never reach a session that belongs to an admin app.
  async applyOwnerState(d: {
    sessionId: string;
    owner: string;
    ownerSessionId: string;
    ownerRevision: bigint;
    appSlug: string;
    state: SessionLifecycleState;
    expiresAt: Date;
    lastActiveAt?: Date | null;
    logoutUrl: string;
  }): Promise<ApplyOwnerStateResult> {
    let session = await db.authDeviceUserSession.findUnique({
      where: { id: d.sessionId }
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionId));

    let app = await db.app.findUnique({ where: { slug: d.appSlug } });
    if (!app || app.oid !== session.appOid) {
      throw new ServiceError(
        forbiddenError({ message: 'Session does not belong to the claiming app' })
      );
    }

    if (session.lifecycleOwner && session.lifecycleOwner !== d.owner) {
      return { applied: false, reason: 'owned_by_other' };
    }

    let isClaimed = session.lifecycleOwner !== null;
    let isCurrentOwnerSession =
      isClaimed && session.lifecycleOwnerSessionId === d.ownerSessionId;

    // An unclaimed session accepts any state, so a session that predates ownership is
    // taken over by whatever happens to it first. Once claimed, only an activation may
    // move the claim: a replaced owner session must not be able to end the ares
    // session that the one which replaced it is still using.
    if (isClaimed && !isCurrentOwnerSession && d.state !== 'active') {
      return { applied: false, reason: 'stale_owner_session' };
    }

    if (
      isCurrentOwnerSession &&
      session.lifecycleOwnerRevision !== null &&
      session.lifecycleOwnerRevision >= d.ownerRevision
    ) {
      return { applied: false, reason: 'stale_revision' };
    }

    // The owner may end a session but never bring one back. Ares closes sessions
    // itself when the account goes away, and a later resync must not undo that.
    if (session.loggedOutAt && d.state === 'active') {
      return { applied: false, reason: 'session_closed' };
    }

    let now = new Date();
    let isTerminal = TERMINAL_LIFECYCLE_STATES.has(d.state);

    // `superseded` deliberately leaves the lifecycle alone: another session took over
    // the device, but this user stays signed in and keeps showing up as a logged in
    // user that can be switched back to.
    let lifecycle = isTerminal
      ? { loggedOutAt: session.loggedOutAt ?? now, expiresAt: now }
      : d.state === 'active'
        ? { loggedOutAt: null, expiresAt: d.expiresAt }
        : {};

    await db.authDeviceUserSession.update({
      where: { oid: session.oid },
      data: {
        ...lifecycle,
        ...(d.lastActiveAt ? { lastActiveAt: d.lastActiveAt } : {}),
        lifecycleOwner: d.owner,
        lifecycleOwnerSessionId: d.ownerSessionId,
        lifecycleOwnerRevision: d.ownerRevision,
        lifecycleOwnerLogoutUrl: d.logoutUrl,
        lifecycleClaimedAt: session.lifecycleClaimedAt ?? now,
        lifecycleSyncedAt: now
      }
    });

    await findAuthSessionCached.clear({ sessionId: session.id });

    return { applied: true };
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
