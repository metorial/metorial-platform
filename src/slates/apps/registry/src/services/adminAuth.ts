import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { addHours } from 'date-fns';
import { aresClient } from '../aresClient';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';

let SESSION_DURATION_HOURS = 24 * 7;

class adminAuthServiceImpl {
  async isEnabled() {
    return !!(env.ares.ARES_AUTH_URL && env.ares.ARES_CLIENT_ID);
  }

  async getAuthUrl(d: { redirectUri: string }) {
    if (!env.ares.ARES_AUTH_URL || !env.ares.ARES_CLIENT_ID) {
      throw new Error('Admin auth is not configured');
    }

    let url = new URL(`${env.ares.ARES_AUTH_URL}/login`);
    url.searchParams.set('redirect_uri', d.redirectUri);
    url.searchParams.set('client_id', env.ares.ARES_CLIENT_ID);
    return url.toString();
  }

  async exchangeCode(d: { code: string }) {
    if (!aresClient || !env.ares.ARES_CLIENT_ID) {
      throw new Error('Admin auth is not configured');
    }

    let result = await aresClient.oauth.exchange({
      clientId: env.ares.ARES_CLIENT_ID,
      authorizationCode: d.code
    });

    let adminUser = await db.adminUser.upsert({
      where: { email: result.user.email },
      update: {
        name: result.user.name
      },
      create: {
        ...getId('adminUser'),
        email: result.user.email,
        name: result.user.name
      }
    });

    let session = await db.adminSession.create({
      data: {
        ...getId('adminSession'),
        token: crypto.randomUUID(),
        adminUserOid: adminUser.oid,
        expiresAt: addHours(new Date(), SESSION_DURATION_HOURS)
      }
    });

    return { adminUser, session };
  }

  async validateSession(d: { token: string }) {
    let session = await db.adminSession.findUnique({
      where: { token: d.token },
      include: { adminUser: true }
    });

    if (!session) {
      throw new ServiceError(unauthorizedError({ message: 'Invalid session' }));
    }

    if (session.expiresAt < new Date()) {
      throw new ServiceError(unauthorizedError({ message: 'Session expired' }));
    }

    return { adminUser: session.adminUser, session };
  }
}

export let adminAuthService = Service.create(
  'adminAuthService',
  () => new adminAuthServiceImpl()
).build();
