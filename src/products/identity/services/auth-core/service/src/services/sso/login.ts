import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  Account,
  App,
  AuthDevice,
  SsoConnection,
  SsoTenant,
  SsoUserProfile
} from '../../../prisma/generated/client';
import { validateRedirectUrl } from '../../lib/validateRedirectUrl';
import { authService } from '../auth';
import { deviceService } from '../device';

class SsoLoginServiceImpl {
  async completeLogin(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    app: App;
    account?: Account | null;
    device: AuthDevice;
    context: { ip: string; ua: string };
    redirectUrl: string;
  }) {
    if (
      d.tenant.appOid !== d.app.oid ||
      (d.tenant.enrollment == 'account' &&
        (!d.account || d.tenant.accountOid !== d.account.oid))
    ) {
      throw new ServiceError(
        badRequestError({ message: 'SSO tenant does not belong to this app' })
      );
    }

    let authAttempt = await authService.authWithSso({
      ssoUser: {
        email: d.userProfile.email,
        firstName: d.userProfile.firstName,
        lastName: d.userProfile.lastName
      },
      ssoConnectionId: d.connection.id,
      ssoUid: d.userProfile.uid,
      ssoTenant: d.tenant,
      ssoUserProfile: d.userProfile,
      context: d.context,
      redirectUrl: d.redirectUrl,
      device: d.device,
      app: d.app,
      account: d.account
    });

    validateRedirectUrl(authAttempt.redirectUrl, d.app.redirectDomains);

    let session = await deviceService.exchangeAuthAttemptForSession({
      authAttempt
    });

    return { authAttempt, session };
  }
}

export let ssoLoginService = new SsoLoginServiceImpl();
