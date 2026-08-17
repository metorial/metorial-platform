import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  authenticateWithConsumerSessionToken,
  consumerSessionInclude,
  type ConsumerTokenSession,
  getConsumerAccessContextForSession as getConsumerAccessContextForSessionFromToken,
  getConsumerSessionToken,
  getConsumerToken
} from '@metorial/consumer-auth';
import { Context } from '@metorial/context';
import { ConsumerProfile, ConsumerSession, ConsumerSurface, db, ID, User } from '@metorial/db';
import { addDays } from 'date-fns';
import {
  isConsumerSurfaceEmailWhitelisted,
  normalizeConsumerSurfaceEmail
} from '../lib/consumerSurfaceEmailWhitelist';
import { consumerProfileService } from './consumerProfile';

class ConsumerAuthServiceImpl {
  private getSessionExpiryDate(d: { consumerSurface: ConsumerSurface; isForUser: boolean }) {
    if (d.isForUser) {
      return addDays(new Date(), 365);
    }

    return new Date(Date.now() + d.consumerSurface.sessionExpiryTimeInSeconds * 1000);
  }

  private async hasInviteBypassForEmail(d: { surface: ConsumerSurface; email: string }) {
    let email = normalizeConsumerSurfaceEmail(d.email);
    let invite = await db.consumerInvite.findFirst({
      where: {
        surfaceOid: d.surface.oid,
        status: {
          in: ['pending', 'accepted']
        },
        consumerProfile: {
          status: 'active',
          email: {
            equals: email,
            mode: 'insensitive'
          }
        }
      },
      select: {
        id: true
      }
    });

    return Boolean(invite);
  }

  private async assertEmailCanAccessSurface(d: { surface: ConsumerSurface; email: string }) {
    if (
      isConsumerSurfaceEmailWhitelisted({
        email: d.email,
        emailWhitelist: d.surface.emailWhitelist
      })
    ) {
      return;
    }

    if (
      await this.hasInviteBypassForEmail({
        surface: d.surface,
        email: d.email
      })
    ) {
      return;
    }

    throw new ServiceError(
      forbiddenError({
        message: 'This email address is not allowed to access this portal.'
      })
    );
  }

  async createConsumerSession(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    context: Context;
    authSessionId?: string | null;
  }) {
    if (d.authSessionId) {
      let existingSession = await db.consumerSession.findUnique({
        where: {
          consumerProfileOid_authSessionId: {
            authSessionId: d.authSessionId,
            consumerProfileOid: d.consumerProfile.oid
          }
        }
      });

      if (existingSession) {
        if (existingSession.loggedOutAt || existingSession.expiresAt < new Date()) {
          return await db.consumerSession.update({
            where: {
              oid: existingSession.oid
            },
            data: {
              tokenNonce: await ID.generateId('clientSecret'),
              expiresAt: this.getSessionExpiryDate({
                consumerSurface: d.consumerSurface,
                isForUser: true
              }),
              loggedOutAt: null,
              ua: d.context.ua ?? 'unknown',
              ip: d.context.ip,
              lastUsedAt: new Date()
            },
            include: consumerSessionInclude
          });
        }

        return await db.consumerSession.update({
          where: {
            oid: existingSession.oid
          },
          data: {
            lastUsedAt: new Date()
          },
          include: consumerSessionInclude
        });
      }
    }

    try {
      return await db.consumerSession.create({
        data: {
          id: await ID.generateId('consumerSession'),
          tokenNonce: await ID.generateId('clientSecret'),
          consumerProfileOid: d.consumerProfile.oid,
          authSessionId: d.authSessionId ?? null,
          ua: d.context.ua ?? 'unknown',
          ip: d.context.ip,
          expiresAt: this.getSessionExpiryDate({
            consumerSurface: d.consumerSurface,
            isForUser: !!d.authSessionId
          })
        },
        include: consumerSessionInclude
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        let res = await db.consumerSession.findUnique({
          where: {
            consumerProfileOid_authSessionId: {
              authSessionId: d.authSessionId!,
              consumerProfileOid: d.consumerProfile.oid
            }
          },
          include: consumerSessionInclude
        });
        if (res) return res;
      }

      throw err;
    }
  }

  async authenticateWithUserAuthSession(d: {
    consumerSurface: ConsumerSurface;
    context: Context;
    user: User;
    authSessionId: string;
  }) {
    let profile: ConsumerProfile =
      await consumerProfileService.getConsumerProfileForUserAndSurface({
        user: d.user,
        consumerSurface: d.consumerSurface
      });

    if (profile.inviteStatus == 'invited') {
      profile = await consumerProfileService.activateConsumerProfile({
        consumerProfile: profile
      });
    }

    let session = await this.createConsumerSession({
      consumerSurface: d.consumerSurface,
      consumerProfile: profile,
      context: d.context,
      authSessionId: d.authSessionId
    });

    return session;
  }

  async getConsumerToken(d: { session: ConsumerTokenSession; surface: ConsumerSurface }) {
    return await getConsumerToken(d);
  }

  async getConsumerSessionToken(d: {
    session: ConsumerTokenSession;
    surface: ConsumerSurface;
  }) {
    return await getConsumerSessionToken(d);
  }

  async authenticateWithConsumerSessionToken(d: { token: string; surface: ConsumerSurface }) {
    return await authenticateWithConsumerSessionToken({
      token: d.token,
      surfaceOid: d.surface.oid
    });
  }

  async getConsumerAccessContextForSession(d: {
    session: Awaited<ReturnType<typeof authenticateWithConsumerSessionToken>>;
  }) {
    return await getConsumerAccessContextForSessionFromToken({
      session: d.session
    });
  }

  async revokeConsumerSession(d: { session: ConsumerSession }) {
    if (d.session.loggedOutAt) {
      return d.session;
    }

    return await db.consumerSession.update({
      where: {
        oid: d.session.oid
      },
      data: {
        loggedOutAt: new Date()
      }
    });
  }
}

export let consumerAuthService = Service.create(
  'consumerAuthService',
  () => new ConsumerAuthServiceImpl()
).build();
