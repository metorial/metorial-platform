import { isServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  authenticateWithConsumerSessionToken,
  getConsumerAccessContextForSession as getConsumerAccessContextForSessionFromToken,
  getSsoMembershipForUser,
  getConsumerSessionToken,
  getConsumerToken,
  normalizeStringList
} from '@metorial/consumer-auth';
import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ConsumerSession,
  ConsumerSurface,
  db,
  ID,
  withTransaction
} from '@metorial/db';
import { consumerAresService } from './ares';

class ConsumerAuthServiceImpl {
  private getSessionExpiryDate(d: { consumerSurface: ConsumerSurface }) {
    return new Date(Date.now() + d.consumerSurface.sessionExpiryTimeInSeconds * 1000);
  }

  private async syncAresProfileMembership(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
  }) {
    if (!d.consumerSurface.consumerAuthTenantOid || !d.consumerProfile.aresUserId) {
      return d.consumerProfile;
    }

    let consumerAuthTenant = await db.consumerAuthTenant.findUnique({
      where: {
        oid: d.consumerSurface.consumerAuthTenantOid
      }
    });
    if (!consumerAuthTenant?.aresAppId) {
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

  async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    aresUserId: string;
    email: string;
    name: string;
    ssoGroupIds?: string[];
    ssoRoles?: string[];
  }) {
    return await withTransaction(async tx => {
      let ssoGroupIds = normalizeStringList(d.ssoGroupIds);
      let ssoRoles = normalizeStringList(d.ssoRoles);
      let consumer = await tx.consumer.upsert({
        where: {
          email_organizationOid: {
            email: d.email,
            organizationOid: d.surface.organizationOid
          }
        },
        create: {
          id: await ID.generateId('consumer'),
          email: d.email,
          name: d.name,
          organizationOid: d.surface.organizationOid
        },
        update: {
          email: d.email,
          name: d.name
        }
      });

      let existingProfile = await tx.consumerProfile.findUnique({
        where: {
          surfaceOid_aresUserId: {
            surfaceOid: d.surface.oid,
            aresUserId: d.aresUserId
          }
        }
      });
      if (existingProfile) {
        return await tx.consumerProfile.update({
          where: {
            oid: existingProfile.oid
          },
          data: {
            aresUserId: d.aresUserId,
            email: d.email,
            name: d.name,
            consumerOid: consumer.oid,
            ssoGroupIds,
            ssoRoles
          }
        });
      }

      let accessTag = await tx.accessTag.create({
        data: {
          instanceOid: d.surface.instanceOid
        }
      });

      let personalConsumerGroup = await tx.consumerGroup.create({
        data: {
          id: await ID.generateId('consumerGroup'),
          status: 'active',
          type: 'user_access',
          isDefault: false,
          ssoGroupIds: [],
          name: `Personal Group for ${d.email}`,
          description: null,
          surfaceOid: d.surface.oid,
          accessTagOid: accessTag.oid
        }
      });

      return await tx.consumerProfile.create({
        data: {
          id: await ID.generateId('consumerProfile'),
          aresUserId: d.aresUserId,
          email: d.email,
          name: d.name,
          ssoGroupIds,
          ssoRoles,
          organizationOid: d.surface.organizationOid,
          instanceOid: d.surface.instanceOid,
          surfaceOid: d.surface.oid,
          consumerOid: consumer.oid,
          accessTagOid: accessTag.oid,
          personalConsumerGroupOid: personalConsumerGroup.oid
        }
      });
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

  async getConsumerToken(d: { session: ConsumerSession; surface: ConsumerSurface }) {
    return await getConsumerToken(d);
  }

  async getConsumerSessionToken(d: { session: ConsumerSession; surface: ConsumerSurface }) {
    return await getConsumerSessionToken(d);
  }

  async authenticateWithConsumerSessionToken(d: {
    token: string;
    surface: ConsumerSurface;
  }) {
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

    if (d.session.aresSessionId) {
      try {
        await consumerAresService.logoutSession({
          sessionId: d.session.aresSessionId
        });
      } catch (err) {
        if (
          !isServiceError(err) ||
          (err.data.status != 401 && err.data.status != 404)
        ) {
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
