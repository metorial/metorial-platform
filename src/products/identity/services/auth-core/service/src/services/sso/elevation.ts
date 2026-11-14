import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { db } from '../../db';
import { getId } from '../../id';
import { validateRedirectUrl } from '../../lib/validateRedirectUrl';
import { auditLogService } from '../auditLog';
import { authService } from '../auth';
import { userService } from '../user';
import { ssoAuthService } from './auth';
import { getSsoAuthStartUrl } from './authStart';

let identityMismatchError = () =>
  new ServiceError(
    forbiddenError({
      code: 'sso_elevation_identity_mismatch',
      message: 'You signed in with a different account than the one you are using.'
    })
  );

class SsoElevationServiceImpl {
  private async getActiveUser(d: { userId: string }) {
    let user = await userService.getUser({ userId: d.userId });
    if (user.status != 'active' || user.deletedAt) {
      throw new ServiceError(forbiddenError({ message: 'User is not active' }));
    }

    let app = await db.app.findUniqueOrThrow({ where: { oid: user.appOid } });

    return { user, app };
  }

  private async listConnections(d: { userId: string }) {
    let { user, app } = await this.getActiveUser(d);

    let { account, connections } = await authService.getSsoConnections({
      app,
      email: user.email,
      includeHidden: true
    });

    // Without an account the result is the app-wide tenants, which say nothing about
    // whether this particular user is governed by SSO.
    if (!account) return { user, app, account, connections: [] };

    return { user, app, account, connections };
  }

  async listOptions(d: { userId: string }) {
    let { connections } = await this.listConnections(d);

    return connections.map(connection => ({
      tenantId: connection.tenant.id,
      connectionId: connection.id,
      name: connection.name,
      providerType: connection.providerType,
      providerName: connection.providerName
    }));
  }

  async create(d: {
    userId: string;
    tenantId: string;
    connectionId: string;
    redirectUri: string;
  }) {
    let { user, app, account, connections } = await this.listConnections(d);
    validateRedirectUrl(d.redirectUri, app.redirectDomains);

    let connection = connections.find(
      connection => connection.id == d.connectionId && connection.tenant.id == d.tenantId
    );
    if (!connection) {
      throw new ServiceError(
        badRequestError({ message: 'SSO connection is not available for this user' })
      );
    }

    let auth = await ssoAuthService.createAuth({
      tenant: connection.tenant,
      account,
      connection,
      input: {
        redirectUri: d.redirectUri,
        state: generateCustomId('sso_state', 50),
        email: user.email,
        purpose: 'elevation',
        forceAuthn: true
      }
    });

    let url = await getSsoAuthStartUrl({
      auth,
      tenant: connection.tenant,
      connection,
      email: user.email
    });

    return { authId: auth.id, url };
  }

  async complete(d: {
    userId: string;
    authId: string;
    tenantId: string;
    context: { ip: string; ua: string };
  }) {
    let { user, app } = await this.getActiveUser(d);

    let { tenant, connection, userProfile } = await ssoAuthService.completeAuth({
      authId: d.authId,
      tenantId: d.tenantId,
      purpose: 'elevation'
    });
    if (tenant.appOid != app.oid) throw identityMismatchError();

    let provider = await db.userIdentityProvider.findFirst({
      where: { ssoTenantOid: tenant.oid }
    });
    let identity = provider
      ? await db.userIdentity.findFirst({
          where: { providerOid: provider.oid, uid: userProfile.uid }
        })
      : null;

    if (identity?.userOid && identity.userOid != user.oid) throw identityMismatchError();

    if (!identity?.userOid) {
      // Mirrors login, which links an unlinked SSO identity to the user owning its email.
      let assertedEmail = userProfile.email.trim().toLowerCase();
      let ownsEmail =
        user.email.trim().toLowerCase() == assertedEmail ||
        user.userEmails.some(
          email => email.verifiedAt && email.email.trim().toLowerCase() == assertedEmail
        );
      if (!ownsEmail) throw identityMismatchError();

      await this.linkIdentity({ provider, tenant, identity, userProfile, userOid: user.oid });
    }

    auditLogService.log({
      appOid: app.oid,
      type: 'elevation.sso',
      userOid: user.oid,
      ip: d.context.ip,
      ua: d.context.ua,
      metadata: {
        ssoTenantId: tenant.id,
        ssoConnectionId: connection.id
      }
    });

    return {
      userId: user.id,
      tenantId: tenant.id,
      connectionId: connection.id,
      connectionSourceId: connection.sourceId,
      email: userProfile.email,
      completedAt: new Date()
    };
  }

  private async linkIdentity(d: {
    provider: { oid: bigint } | null;
    tenant: { oid: bigint; name: string };
    identity: { oid: bigint } | null;
    userProfile: {
      oid: bigint;
      uid: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    userOid: bigint;
  }) {
    if (d.identity) {
      await db.userIdentity.update({
        where: { oid: d.identity.oid },
        data: { userOid: d.userOid, ssoUserProfileOid: d.userProfile.oid }
      });
      return;
    }

    let provider =
      d.provider ??
      (await db.userIdentityProvider.create({
        data: {
          ...getId('userIdentityProvider'),
          ssoTenantOid: d.tenant.oid,
          name: d.tenant.name
        }
      }));

    await db.userIdentity.create({
      data: {
        ...getId('userIdentity'),
        uid: d.userProfile.uid,
        email: d.userProfile.email,
        firstName: d.userProfile.firstName,
        lastName: d.userProfile.lastName,
        name: `${d.userProfile.firstName} ${d.userProfile.lastName}`.trim(),
        photoUrl: null,
        providerOid: provider.oid,
        ssoUserProfileOid: d.userProfile.oid,
        userOid: d.userOid
      }
    });
  }
}

export let ssoElevationService = Service.create(
  'SsoElevationService',
  () => new SsoElevationServiceImpl()
).build();
