import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
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
import { Fabric } from '@metorial/fabric';
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { addDays } from 'date-fns';
import { isConsumerInviteExpired } from '../lib/consumerInviteExpiry';
import {
  isConsumerSurfaceEmailWhitelisted,
  normalizeConsumerSurfaceEmail
} from '../lib/consumerSurfaceEmailWhitelist';
import { consumerProfileService } from './consumerProfile';

let consumerSessionAuditScope = (d: {
  consumerSurface: ConsumerSurface;
  consumerProfile: Pick<ConsumerProfile, 'id'>;
  context: Context;
}): AuditScope => ({
  organizationOid: d.consumerSurface.organizationOid,
  instanceOid: d.consumerSurface.instanceOid,
  actor: {
    type: 'consumer_profile',
    id: d.consumerProfile.id
  },
  context: d.context
});

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

  private async assertCanAcceptInvite(d: {
    consumerProfile: ConsumerProfile;
    consumerSurface: ConsumerSurface;
    user: User;
  }) {
    let invite = await db.consumerInvite.findFirst({
      where: {
        consumerProfileOid: d.consumerProfile.oid,
        status: 'pending'
      },
      select: {
        expiresAt: true,
        legacyGraceStartedAt: true
      }
    });
    if (invite && !isConsumerInviteExpired(invite)) return;

    if (await this.hasAccessWithoutInvite(d)) return;

    throw new ServiceError(
      forbiddenError({
        message: invite ? 'This invite has expired.' : 'This invite is no longer valid.'
      })
    );
  }

  private async hasAccessWithoutInvite(d: { consumerSurface: ConsumerSurface; user: User }) {
    if (d.user.type == 'system' || d.consumerSurface.status != 'active') return false;

    let member = await db.organizationMember.findFirst({
      where: {
        userOid: d.user.oid,
        organizationOid: d.consumerSurface.organizationOid,
        status: 'active'
      },
      select: { oid: true }
    });
    if (!member) return false;

    if (d.consumerSurface.type == 'organization_members') return true;
    if (d.consumerSurface.type != 'portal') return false;

    let portal = await db.portal.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        status: 'active',
        instance: {
          project: {
            status: 'active',
            autoAddOrganizationMembersToPortals: true
          }
        }
      },
      select: { oid: true }
    });

    return !!portal;
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
          let consumerSession = await db.consumerSession.update({
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

          await Fabric.fire('consumer.session.created:after', {
            consumerSession,
            auditScope: consumerSessionAuditScope(d)
          });

          return consumerSession;
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
      let consumerSession = await db.consumerSession.create({
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

      await Fabric.fire('consumer.session.created:after', {
        consumerSession,
        auditScope: consumerSessionAuditScope(d)
      });

      return consumerSession;
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
      await this.assertCanAcceptInvite({
        consumerProfile: profile,
        consumerSurface: d.consumerSurface,
        user: d.user
      });

      profile = await consumerProfileService.activateConsumerProfile({
        consumerProfile: profile,
        auditScope: consumerSessionAuditScope({
          consumerSurface: d.consumerSurface,
          consumerProfile: profile,
          context: d.context
        })
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

  async revokeConsumerSession(d: { session: ConsumerSession; auditScope: AuditScope }) {
    if (d.session.loggedOutAt) {
      return d.session;
    }

    if (d.session.oauthAuthorizationOid) {
      let oauthAuthorization = await db.oAuthAuthorization.findUniqueOrThrow({
        where: { oid: d.session.oauthAuthorizationOid },
        include: { consumerProfile: true, oauthApplication: true }
      });

      let isUserRevocable =
        oauthAuthorization.status == 'active' &&
        (oauthAuthorization.oauthApplication.type == 'user_facing' ||
          oauthAuthorization.oauthApplication.type == 'cli_auth');

      if (oauthAuthorization.consumerProfile && isUserRevocable) {
        await oauthAuthorizationService.revokeConsumerOAuthAuthorization({
          consumerProfile: oauthAuthorization.consumerProfile,
          oauthAuthorizationId: oauthAuthorization.id,
          context: d.auditScope.context
        });
      }
    }

    let consumerSession = await db.consumerSession.update({
      where: {
        oid: d.session.oid
      },
      data: {
        loggedOutAt: new Date()
      },
      include: consumerSessionInclude
    });

    await Fabric.fire('consumer.session.revoked:after', {
      consumerSession,
      auditScope: d.auditScope
    });

    return consumerSession;
  }
}

export let consumerAuthService = Service.create(
  'consumerAuthService',
  () => new ConsumerAuthServiceImpl()
).build();
