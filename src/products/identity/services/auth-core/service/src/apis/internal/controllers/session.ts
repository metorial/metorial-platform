import { notFoundError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { deviceService } from '../../../services/device';
import { SESSION_LIFECYCLE_STATES, sessionService } from '../../../services/session';
import { internalApp } from '../_app';
import { userPresenter } from '../presenters';

export let sessionController = internalApp.controller({
  get: internalApp
    .handler()
    .input(
      v.object({
        sessionId: v.string()
      })
    )
    .do(async ({ input }) => {
      let session = await sessionService.getSessionSafe({ sessionId: input.sessionId });
      if (!session) throw new ServiceError(notFoundError('session', input.sessionId));

      return {
        id: session.id,
        userId: session.user.id,
        deviceId: session.device.id,
        loggedOutAt: session.loggedOutAt,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        lifecycleOwner: session.lifecycleOwner,
        lifecycleOwnerSessionId: session.lifecycleOwnerSessionId
      };
    }),

  getLoggedInUsers: internalApp
    .handler()
    .input(
      v.object({
        sessionId: v.string()
      })
    )
    .do(async ({ input }) => {
      let session = await sessionService.getSessionSafe({ sessionId: input.sessionId });
      if (!session) throw new ServiceError(notFoundError('session', input.sessionId));

      let sessions = await deviceService.getLoggedInUsersForDevice({
        device: session.device
      });

      return await Promise.all(
        sessions.map(async s => ({
          sessionId: s.id,
          loggedInAt: s.createdAt,
          lastActiveAt: s.lastActiveAt,
          user: await userPresenter(s.user)
        }))
      );
    }),

  applyOwnerState: internalApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        owner: v.string(),
        ownerSessionId: v.string(),
        ownerRevision: v.string(),
        appSlug: v.string(),
        state: v.enumOf(SESSION_LIFECYCLE_STATES),
        expiresAt: v.date(),
        lastActiveAt: v.optional(v.nullable(v.date())),
        logoutUrl: v.string()
      })
    )
    .do(async ({ input }) => {
      return await sessionService.applyOwnerState({
        ...input,
        ownerRevision: BigInt(input.ownerRevision)
      });
    }),

  logout: internalApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        owner: v.optional(v.string())
      })
    )
    .do(async ({ input }) => {
      let session = await sessionService.getSessionSafe({ sessionId: input.sessionId });
      if (!session) throw new ServiceError(notFoundError('session', input.sessionId));

      await sessionService.logout({ session, owner: input.owner });

      return {};
    })
});
