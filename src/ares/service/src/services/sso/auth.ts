import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { SsoTenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId, ID } from '../../id';

export let ssoAuthService = {
  async createAuth(d: {
    tenant: SsoTenant;
    input: {
      redirectUri: string;
      email?: string;
      state: string;
    };
  }) {
    return await db.ssoAuth.create({
      data: {
        ...getId('ssoAuth'),
        clientSecret: await ID.generateId('ssoAuth_clientSecret'),
        tenantOid: d.tenant.oid,
        state: d.input.state,
        redirectUri: d.input.redirectUri,
        email: d.input.email ?? null
      }
    });
  },

  async getAuthByClientSecret(d: { clientSecret: string }) {
    let auth = await db.ssoAuth.findUnique({
      where: { clientSecret: d.clientSecret },
      include: { tenant: true }
    });
    if (!auth) throw new ServiceError(notFoundError('sso.auth'));
    return auth;
  },

  async completeAuth(d: { authId: string }) {
    let auth = await db.ssoAuth.findUnique({
      where: { id: d.authId },
      include: {
        tenant: true,
        connection: true,
        userProfile: true,
        user: true
      }
    });

    if (
      !auth ||
      auth.status != 'completed' ||
      !auth.user ||
      !auth.connection ||
      !auth.userProfile
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }

    await db.ssoAuth.delete({ where: { oid: auth.oid } });

    return {
      auth,
      user: auth.user,
      tenant: auth.tenant,
      connection: auth.connection,
      userProfile: auth.userProfile
    };
  }
};
