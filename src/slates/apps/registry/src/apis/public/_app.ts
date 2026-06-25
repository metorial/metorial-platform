import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import type { Context } from 'hono';
import { env } from '../../env';
import { readerTokenService, subRegistryService, userTokenService } from '../../services';

let useExtractToken = async (ctx: Context) => {
  let authHeader = ctx.req.header('Authorization');
  if (!authHeader) return null;

  let parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid Authorization header format'
      })
    );
  }

  let token = parts[1];

  return token;
};

export let useAuth = async (ctx: Context) => {
  let token = await useExtractToken(ctx);
  if (!token && env.access.PUBLIC_ACCESS_PERMITTED === false) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing Authorization header'
      })
    );
  }

  let subRegistry = await subRegistryService.getSubRegistryFromUrl({
    url: ctx.req.url,
    subRegistryId:
      ctx.req.header('Metorial-Sub-Registry-Id') ??
      ctx.req.header('Slates-Sub-Registry-Id') ??
      undefined
  });

  if (!token) {
    return {
      type: 'public' as const,
      tenant: subRegistry?.tenant,
      subRegistry,
      user: undefined
    };
  }

  let userAuth = await userTokenService.authenticateWithUserToken({ secret: token });
  if (userAuth.status == 'success') {
    if (subRegistry && userAuth.tenant.oid !== subRegistry?.tenant.oid) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Token does not have access to the specified sub-registry'
        })
      );
    }

    return { type: 'user' as const, subRegistry, ...userAuth };
  }

  let readerAuth = await readerTokenService.authenticateWithReaderToken({ secret: token });
  if (readerAuth.status == 'success') {
    if (
      subRegistry &&
      readerAuth.tenant &&
      readerAuth.tenant.oid !== subRegistry?.tenant.oid
    ) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Token does not have access to the specified sub-registry'
        })
      );
    }

    return {
      type: 'reader' as const,
      subRegistry,
      ...readerAuth,
      tenant: readerAuth.tenant ?? subRegistry?.tenant
    };
  }

  throw new ServiceError(userAuth.error || readerAuth.error);
};

export let useAuthRequired = async (ctx: Context) => {
  let auth = await useAuth(ctx);
  if (auth.type === 'public') {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing Authorization header'
      })
    );
  }

  return auth;
};

export let useUserAuth = async (ctx: Context) => {
  let auth = await useAuthRequired(ctx);
  if (auth.type !== 'user') {
    throw new ServiceError(
      unauthorizedError({
        message: 'Must authenticate with a user token to access this endpoint'
      })
    );
  }

  return auth;
};
