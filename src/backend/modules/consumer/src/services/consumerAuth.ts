import {
  isServiceError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  authenticateWithConsumerSessionToken,
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
  ID
} from '@metorial/db';
import { consumerAresService } from './ares';
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

  private getSessionExpiryDate(d: { consumerSurface: ConsumerSurface }) {
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
          consumerSurface: d.consumerSurface
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
  }) {
    let consumerProfile =
      d.aresSessionId && d.consumerProfile.aresUserId
        ? await this.syncAresProfileMembership({
            consumerSurface: d.consumerSurface,
            consumerProfile: d.consumerProfile
          })
        : d.consumerProfile;

    return await db.consumerSession.create({
      data: {
        id: await ID.generateId('consumerSession'),
        tokenNonce: await ID.generateId('clientSecret'),
        aresSessionId: d.aresSessionId ?? null,
        consumerProfileOid: consumerProfile.oid,
        ua: d.context.ua ?? 'unknown',
        ip: d.context.ip,
        expiresAt: this.getSessionExpiryDate({
          consumerSurface: d.consumerSurface
        })
      }
    });
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
    state: string;
  }) {
    let consumerAuthTenant = await this.getConsumerAuthTenantOrThrow({
      surface: d.surface
    });
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
