import { Group } from '@lowerdeck/rpc-server';
import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../env';

export let app = new Group();

let credentialMatches = (provided: string | null, expected: string | undefined) => {
  if (!provided || !expected) return false;
  let supplied = Buffer.from(provided, 'utf8');
  let configured = Buffer.from(expected, 'utf8');
  return (
    supplied.byteLength === configured.byteLength && timingSafeEqual(supplied, configured)
  );
};

export let internalApp = app.use(async ctx => {
  if (
    !credentialMatches(
      ctx.headers.get('x-metorial-signal-service-credential'),
      env.internal.HUB_SERVICE_CREDENTIAL
    )
  ) {
    // The same closed response is used for missing and invalid credentials and is evaluated
    // before tenant/key resolution, so callers cannot enumerate idempotency keys.
    throw new ServiceError(
      unauthorizedError({ message: 'Signal internal service authentication failed.' })
    );
  }
  return { internalServiceAuthenticated: true as const };
});

export let subspaceInternalApp = app.use(async ctx => {
  if (
    !credentialMatches(
      ctx.headers.get('x-metorial-signal-service-credential'),
      env.internal.SUBSPACE_SERVICE_CREDENTIAL
    )
  ) {
    throw new ServiceError(
      unauthorizedError({ message: 'Signal internal service authentication failed.' })
    );
  }
  return { subspaceInternalServiceAuthenticated: true as const };
});
