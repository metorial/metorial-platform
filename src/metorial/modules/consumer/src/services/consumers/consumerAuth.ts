import {
  forbiddenError,
  isServiceError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  authenticateWithConsumerSessionToken,
  consumerSessionInclude,
  type ConsumerTokenSession,
  getConsumerAccessContextForSession as getConsumerAccessContextForSessionFromToken,
  getConsumerSessionToken,
  getConsumerToken,
  getSsoMembershipForUser,
  normalizeStringList
} from '@metorial/consumer-auth';
import { Context } from '@metorial/context';
import {
  ConsumerAuthTenant,
  ConsumerProfile,
  ConsumerSession,
  ConsumerSurface,
  db,
  ID,
  User
} from '@metorial/db';
import { addDays } from 'date-fns';
import {
  isConsumerSurfaceEmailWhitelisted,
  normalizeConsumerSurfaceEmail
} from '../../lib/consumerSurfaceEmailWhitelist';
import { consumerAresService } from '../consumerAccess/ares';
import { consumerProfileService } from './consumerProfile';

class ConsumerAuthServiceImpl {
  private ensureSurfaceIsActive(d: { surface: ConsumerSurface }) {
    if (d.surface.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The consumer surface is not active.'
        })
      );
    }
  }

  private getSessionExpiryDate(d: { consumerSurface: ConsumerSurface; isForUser: boolean }) {
    if (d.isForUser) {
      return addDays(new Date(), 365);
    }

    return new Date(Date.now() + d.consumerSurface.sessionExpiryTimeInSeconds * 1000);
  }

  private getAresUserName(d: {
    user: {
      email: string;
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    };
  }) {
    return (
      d.user.name?.trim() ||
      `${d.user.firstName ?? ''} ${d.user.lastName ?? ''}`.trim() ||
      d.user.email.split('@')[0]
    );
  }

  private async getConsumerAuthTenantOrThrow(d: {
    surface: ConsumerSurface;
  }): Promise<ConsumerAuthTenant & { aresAppId: string; aresClientId: string }> {
    this.ensureSurfaceIsActive({
      surface: d.surface
    });

    if (!d.surface.consumerAuthTenantOid) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Auth is not configured for this portal.'
        })
      );
    }

    let consumerAuthTenant = await db.consumerAuthTenant.findUniqueOrThrow({
      where: {
        oid: d.surface.consumerAuthTenantOid
      }
    });
    if (!consumerAuthTenant.aresAppId || !consumerAuthTenant.aresClientId) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Auth is not configured for this portal.'
        })
      );
    }

    return consumerAuthTenant as ConsumerAuthTenant & {
      aresAppId: string;
      aresClientId: string;
    };
  }

  private async getAuthExchangeOrThrow(d: { surface: ConsumerSurface; state: string }) {
    let authExchange = await db.consumerAuthExchange.findFirst({
      where: {
        surfaceOid: d.surface.oid,
        state: d.state,
        completedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });
    if (!authExchange) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Portal SSO state is invalid or has expired.'
        })
      );
    }

    return authExchange;
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

  private async getOrCreateAresConsumerSession(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    context: Context;
    aresSessionId: string;
  }) {
    let existingSession = await db.consumerSession.findFirst({
      where: {
        aresSessionId: d.aresSessionId,
        consumerProfileOid: d.consumerProfile.oid
      },
      orderBy: {
        lastUsedAt: 'desc'
      }
    });

    if (!existingSession) {
      return await this.createConsumerSession({
        consumerSurface: d.consumerSurface,
        consumerProfile: d.consumerProfile,
        context: d.context,
        aresSessionId: d.aresSessionId
      });
    }

    return await db.consumerSession.update({
      where: {
        oid: existingSession.oid
      },
      data: {
        tokenNonce: await ID.generateId('clientSecret'),
        expiresAt: this.getSessionExpiryDate({
          consumerSurface: d.consumerSurface,
          isForUser: false
        }),
        loggedOutAt: null,
        ua: d.context.ua ?? 'unknown',
        ip: d.context.ip,
        lastUsedAt: new Date()
      }
    });
  }

  private async materializeAresConsumerSession(d: {
    context: Context;
    surface: ConsumerSurface;
    consumerAuthTenant: ConsumerAuthTenant & {
      aresAppId: string;
    };
    aresSessionId: string;
    aresUserId: string;
    email: string;
    name: string;
  }) {
    let ssoMembership = await getSsoMembershipForUser({
      userId: d.aresUserId,
      appId: d.consumerAuthTenant.aresAppId
    });
    let consumerProfile = await consumerProfileService.ensureConsumerProfile({
      surface: d.surface,
      aresUserId: d.aresUserId,
      email: d.email,
      name: d.name,
      ssoGroupIds: ssoMembership.groupIds,
      ssoRoles: ssoMembership.roles
    });
    let session = await this.getOrCreateAresConsumerSession({
      consumerSurface: d.surface,
      consumerProfile,
      context: d.context,
      aresSessionId: d.aresSessionId
    });

    return {
      session,
      consumerProfile
    };
  }

  private async syncAresProfileMembership(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
  }) {
    if (!d.consumerProfile.aresUserId || !d.consumerSurface.consumerAuthTenantOid) {
      return d.consumerProfile;
    }

    let consumerAuthTenant = await db.consumerAuthTenant.findUniqueOrThrow({
      where: {
        oid: d.consumerSurface.consumerAuthTenantOid
      }
    });
    if (!consumerAuthTenant.aresAppId) {
      return d.consumerProfile;
    }

    let ssoMembership = await getSsoMembershipForUser({
      userId: d.consumerProfile.aresUserId,
      appId: consumerAuthTenant.aresAppId
    });
    let ssoGroupIds = normalizeStringList(ssoMembership.groupIds);
    let ssoRoles = normalizeStringList(ssoMembership.roles);

    return await db.consumerProfile.update({
      where: {
        oid: d.consumerProfile.oid
      },
      data: {
        ssoGroupIds,
        ssoRoles
      }
    });
  }

  async createConsumerSession(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    context: Context;
    aresSessionId?: string | null;
    authSessionId?: string | null;
  }) {
    let consumerProfile =
      d.aresSessionId && d.consumerProfile.aresUserId
        ? await this.syncAresProfileMembership({
            consumerSurface: d.consumerSurface,
            consumerProfile: d.consumerProfile
          })
        : d.consumerProfile;

    if (d.authSessionId) {
      let existingSession = await db.consumerSession.findUnique({
        where: {
          consumerProfileOid_authSessionId: {
            authSessionId: d.authSessionId,
            consumerProfileOid: consumerProfile.oid
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
          aresSessionId: d.aresSessionId ?? null,
          consumerProfileOid: consumerProfile.oid,
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
              consumerProfileOid: consumerProfile.oid
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
    let profile = await consumerProfileService.getConsumerProfileForUserAndSurface({
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

  async createAresAuthExchange(d: {
    surface: ConsumerSurface;
    state: string;
    expiresAt: Date;
  }) {
    this.ensureSurfaceIsActive({
      surface: d.surface
    });

    return await db.consumerAuthExchange.create({
      data: {
        id: await ID.generateId('consumerAuthExchange'),
        surfaceOid: d.surface.oid,
        state: d.state,
        expiresAt: d.expiresAt
      }
    });
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

  async getAresLoginUrl(d: { surface: ConsumerSurface; redirectUri: string; state?: string }) {
    let consumerAuthTenant = await this.getConsumerAuthTenantOrThrow({
      surface: d.surface
    });

    if (!process.env.ARES_AUTH_URL) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Auth is not configured for this portal.'
        })
      );
    }

    let url = new URL('/login', process.env.ARES_AUTH_URL);
    url.searchParams.set('client_id', consumerAuthTenant.aresClientId);
    url.searchParams.set('redirect_uri', d.redirectUri);
    if (d.state) {
      url.searchParams.set('state', d.state);
    }

    return {
      url: url.toString()
    };
  }

  async authenticateWithAresCode(d: {
    context: Context;
    surface: ConsumerSurface;
    code: string;
    state?: string;
  }) {
    let consumerAuthTenant = await this.getConsumerAuthTenantOrThrow({
      surface: d.surface
    });

    if (d.state === undefined) {
      let { user, session: aresSession } = await consumerAresService.exchangeOAuthCode({
        clientId: consumerAuthTenant.aresClientId,
        code: d.code
      });
      let email = user.email;
      let name = this.getAresUserName({ user });

      await this.assertEmailCanAccessSurface({
        surface: d.surface,
        email
      });

      let { session } = await this.materializeAresConsumerSession({
        context: d.context,
        surface: d.surface,
        consumerAuthTenant,
        aresSessionId: aresSession.id,
        aresUserId: user.id,
        email,
        name
      });

      return { session };
    }

    let authExchange = await this.getAuthExchangeOrThrow({
      surface: d.surface,
      state: d.state
    });

    if (authExchange.code && authExchange.code != d.code) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Portal SSO state is invalid or has expired.'
        })
      );
    }

    if (authExchange.consumerSessionOid) {
      let existingSession = await db.consumerSession.findFirst({
        where: {
          oid: authExchange.consumerSessionOid,
          loggedOutAt: null,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (existingSession) {
        return {
          session: existingSession
        };
      }
    }

    let aresSessionId = authExchange.aresSessionId;
    let aresUserId = authExchange.aresUserId;
    let email = authExchange.email;
    let name = authExchange.name;

    if (!aresSessionId || !aresUserId || !email || !name) {
      let { user, session: aresSession } = await consumerAresService.exchangeOAuthCode({
        clientId: consumerAuthTenant.aresClientId,
        code: d.code
      });

      aresSessionId = aresSession.id;
      aresUserId = user.id;
      email = user.email;
      name = this.getAresUserName({
        user
      });
    }

    if (!aresSessionId || !aresUserId || !email || !name) {
      throw new Error('Invalid Ares auth exchange');
    }

    await this.assertEmailCanAccessSurface({
      surface: d.surface,
      email
    });

    let { session } = await this.materializeAresConsumerSession({
      context: d.context,
      surface: d.surface,
      consumerAuthTenant,
      aresSessionId,
      aresUserId,
      email,
      name
    });

    await db.consumerAuthExchange.update({
      where: {
        oid: authExchange.oid
      },
      data: {
        code: d.code,
        email,
        name,
        aresUserId,
        aresSessionId,
        consumerSessionOid: session.oid,
        completedAt: new Date()
      }
    });

    return {
      session
    };
  }

  async revokeConsumerSession(d: { session: ConsumerSession }) {
    if (d.session.loggedOutAt) {
      return d.session;
    }

    if (d.session.aresSessionId) {
      try {
        await consumerAresService.logoutSession({
          sessionId: d.session.aresSessionId
        });
      } catch (err) {
        if (!isServiceError(err) || (err.data.status != 401 && err.data.status != 404)) {
          throw err;
        }
      }
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
