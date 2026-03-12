import { isServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  authenticateWithConsumerSessionToken,
  getConsumerAccessContextForSession as getConsumerAccessContextForSessionFromToken,
  getConsumerSessionToken,
  getConsumerToken
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

  async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    aresUserId: string;
    email: string;
    name: string;
  }) {
    return await withTransaction(async tx => {
      let consumer = await tx.consumer.findFirst({
        where: {
          organizationOid: d.surface.organizationOid,
          aresUserId: d.aresUserId
        }
      });

      consumer = consumer
        ? await tx.consumer.update({
            where: {
              oid: consumer.oid
            },
            data: {
              aresUserId: d.aresUserId,
              email: d.email,
              name: d.name
            }
          })
        : await tx.consumer.create({
            data: {
              id: await ID.generateId('consumer'),
              aresUserId: d.aresUserId,
              email: d.email,
              name: d.name,
              organizationOid: d.surface.organizationOid
            }
          });

      let existingProfile = await tx.consumerProfile.findFirst({
        where: {
          surfaceOid: d.surface.oid,
          aresUserId: d.aresUserId
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
            consumerOid: consumer.oid
          }
        });
      }

      let profileAccessTag = await tx.accessTag.create({
        data: {
          instanceOid: d.surface.instanceOid
        }
      });
      let personalGroupAccessTag = await tx.accessTag.create({
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
          accessTagOid: personalGroupAccessTag.oid
        }
      });

      return await tx.consumerProfile.create({
        data: {
          id: await ID.generateId('consumerProfile'),
          aresUserId: d.aresUserId,
          email: d.email,
          name: d.name,
          organizationOid: d.surface.organizationOid,
          instanceOid: d.surface.instanceOid,
          surfaceOid: d.surface.oid,
          consumerOid: consumer.oid,
          accessTagOid: profileAccessTag.oid,
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
    return await db.consumerSession.create({
      data: {
        id: await ID.generateId('consumerSession'),
        tokenNonce: await ID.generateId('clientSecret'),
        aresSessionId: d.aresSessionId ?? null,
        consumerProfileOid: d.consumerProfile.oid,
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
    if (d.session.revokedAt) {
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
        revokedAt: new Date()
      }
    });
  }
}

export let consumerAuthService = Service.create(
  'consumerAuthService',
  () => new ConsumerAuthServiceImpl()
).build();
