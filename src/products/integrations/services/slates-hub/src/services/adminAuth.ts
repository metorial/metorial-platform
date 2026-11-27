import { forbiddenError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { addHours } from 'date-fns';
import { aresAdminApp, aresClient } from '../aresClient';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';

let SESSION_DURATION_HOURS = 24 * 7;

let allowedEmailDomains = (env.ares.SLATES_ADMIN_ALLOWED_EMAIL_DOMAINS ?? 'metorial.com')
  .split(',')
  .map(domain => domain.trim().toLowerCase())
  .filter(Boolean);

let isAllowedAdminEmail = (email: string) => {
  let domain = email.toLowerCase().split('@').pop();
  return !!domain && allowedEmailDomains.includes(domain);
};

class adminAuthServiceImpl {
  allowsUnauthenticatedAccess() {
    return env.service.METORIAL_ENV == 'development';
  }

  async isEnabled() {
    return !!env.ares.ARES_AUTH_URL;
  }

  async getAuthUrl(d: { redirectUri: string }) {
    if (!env.ares.ARES_AUTH_URL) {
      throw new Error('Admin auth is not configured');
    }

    let aresApp = await aresAdminApp;

    let url = new URL(`${env.ares.ARES_AUTH_URL}/login`);
    url.searchParams.set('redirect_uri', d.redirectUri);
    url.searchParams.set('client_id', aresApp.clientId);
    return url.toString();
  }

  async exchangeCode(d: { code: string }) {
    if (!aresClient) {
      throw new Error('Admin auth is not configured');
    }

    let aresApp = await aresAdminApp;

    let result = await aresClient.oauth.exchange({
      clientId: aresApp.clientId,
      authorizationCode: d.code
    });

    if (!isAllowedAdminEmail(result.user.email)) {
      throw new ServiceError(
        forbiddenError({ message: 'This account is not allowed to access the admin panel' })
      );
    }

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

    if (!isAllowedAdminEmail(session.adminUser.email)) {
      throw new ServiceError(unauthorizedError({ message: 'Invalid session' }));
    }

    return { adminUser: session.adminUser, session };
  }
}

export let adminAuthService = Service.create(
  'adminAuthService',
  () => new adminAuthServiceImpl()
).build();
