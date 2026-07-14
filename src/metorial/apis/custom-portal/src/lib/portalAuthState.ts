import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import type { ServiceRequest } from '@lowerdeck/rpc-server';
import { getAuthStateCookieName } from './cookies';

export let assertPortalAuthStateOrAllowIdpInitiated = (d: {
  ctx: Pick<ServiceRequest, 'getCookie'>;
  surfaceId: string;
  state?: string | null;
}) => {
  let expectedState = d.ctx.getCookie(getAuthStateCookieName(d.surfaceId));

  if (d.state !== undefined && d.state !== null) {
    if (!d.state || !expectedState || d.state != expectedState) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Portal SSO state is invalid or has expired.'
        })
      );
    }

    return true;
  }

  return false;
};
