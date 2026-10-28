import { badRequestError, ServiceError } from '@lowerdeck/error';
import { randomBytes } from 'crypto';
import type { SsoAuth, SsoConnection, SsoTenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import {
  createDelegationCodeChallenge,
  getDelegationCallbackUri
} from '../../lib/ssoDelegationProtocol';

export let getSsoAuthStartUrl = async (d: {
  auth: SsoAuth;
  tenant: SsoTenant;
  connection?: SsoConnection | null;
  email?: string | null;
}) => {
  if (!d.tenant.importedDelegationOid) {
    let url = new URL('/sso/auth', env.service.ARES_SSO_URL);
    url.searchParams.set('client_secret', d.auth.clientSecret);
    return url.toString();
  }

  let imported = await db.ssoImportedDelegation.findUnique({
    where: { oid: d.tenant.importedDelegationOid },
    include: { remoteInstance: true }
  });
  if (!imported || imported.status !== 'active') {
    throw new ServiceError(badRequestError({ message: 'SSO delegation is disabled' }));
  }

  let codeVerifier = randomBytes(32).toString('base64url');
  await db.ssoAuth.update({
    where: { oid: d.auth.oid },
    data: { codeVerifier }
  });

  let url = new URL(imported.remoteInstance.authorizationEndpointUrl);
  url.searchParams.set('client_id', imported.clientId);
  url.searchParams.set('response_type', 'urn:metorial.com:ares:sso-delegation');
  url.searchParams.set('redirect_uri', getDelegationCallbackUri(env.service.ARES_AUTH_URL));
  url.searchParams.set('state', d.auth.state);
  url.searchParams.set('code_challenge', createDelegationCodeChallenge(codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');

  if (d.connection?.sourceId) url.searchParams.set('connection_id', d.connection.sourceId);
  if (d.email) url.searchParams.set('login_hint', d.email);
  if (d.auth.forceAuthn) url.searchParams.set('force_authn', 'true');

  return url.toString();
};
