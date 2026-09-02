import { forbiddenError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Context, useRequestContext } from '@lowerdeck/hono';
import {
  metorialOutpostResolver,
  outpostAccessService,
  outpostVerificationTokens,
  type OutpostServiceName
} from '@metorial/module-outpost';
import {
  OutpostServerError,
  verifyOutpostRequest,
  type AuthenticatedOutpostRequest
} from '@metorial-outpost/server';
import {
  OUTPOST_ID_HEADER,
  OUTPOST_INSTANCE_TOKEN_HEADER,
  OUTPOST_SIGNATURE_HEADER
} from '@metorial-outpost/signature';
import { isIP } from 'node:net';
import { getSentry } from '@lowerdeck/sentry';

let Sentry = getSentry();

export let MCP_CONNECTION_PROXY_SERVICE: OutpostServiceName = 'mcp_connection_proxy';

let hasOutpostHeaders = (c: Context) =>
  !!(
    c.req.header(OUTPOST_ID_HEADER) &&
    c.req.header(OUTPOST_SIGNATURE_HEADER) &&
    c.req.header(OUTPOST_INSTANCE_TOKEN_HEADER)
  );

export let verifyOutpostConnectionRequest = async (
  c: Context
): Promise<AuthenticatedOutpostRequest | undefined> => {
  if (!hasOutpostHeaders(c)) return undefined;

  try {
    return await verifyOutpostRequest(
      {
        tokens: outpostVerificationTokens,
        service: MCP_CONNECTION_PROXY_SERVICE,
        resolver: metorialOutpostResolver
      },
      c as any
    );
  } catch (error) {
    Sentry.captureException(error);

    if (error instanceof OutpostServerError) {
      let toService =
        error.status === 401
          ? unauthorizedError({ message: `Outpost signature rejected: ${error.code}` })
          : forbiddenError({ message: `Outpost signature rejected: ${error.code}` });

      throw new ServiceError(toService);
    }

    throw error;
  }
};

export let setOutpostAuth = (
  c: Context,
  outpostAuth: AuthenticatedOutpostRequest | undefined
) =>
  (
    c as unknown as {
      set(key: 'outpostAuth', value: AuthenticatedOutpostRequest | undefined): void;
    }
  ).set('outpostAuth', outpostAuth);

export let getOutpostAuth = (c: Context): AuthenticatedOutpostRequest | undefined =>
  (
    c as unknown as {
      get(key: 'outpostAuth'): AuthenticatedOutpostRequest | undefined;
    }
  ).get('outpostAuth');

export let outpostConnectionAuthMiddleware = async (c: Context, next: () => Promise<void>) => {
  let outpostRes = await verifyOutpostConnectionRequest(c);
  setOutpostAuth(c, outpostRes);
  return next();
};

let isPrivateOrUnroutableIp = (ip: string) =>
  ip === '0.0.0.0' || ip === '::' || ip === '0:0:0:0:0:0:0:0';

export let isValidRoutableIp = (ip: string | undefined): ip is string => {
  if (!ip) return false;

  let trimmed = ip.trim();
  if (!trimmed || isPrivateOrUnroutableIp(trimmed)) return false;

  return isIP(trimmed) !== 0;
};

export let resolveOutpostForwardedIp = (
  outpostAuth: AuthenticatedOutpostRequest | undefined
): string | undefined => {
  let ip = outpostAuth?.proxyContext?.ip;
  return isValidRoutableIp(ip) ? ip : undefined;
};

export let resolveOutpostOrigin = (
  outpostAuth: AuthenticatedOutpostRequest | undefined
): string | undefined => {
  let baseUrl = outpostAuth?.proxyContext?.base_url;
  if (!baseUrl) return undefined;

  try {
    let parsed = new URL(baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return baseUrl.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
};

export let useConnectionRequestContext = (c: Context) => {
  let base = useRequestContext(c);
  let outpostAuth = getOutpostAuth(c);
  let forwardedIp = resolveOutpostForwardedIp(outpostAuth);

  return { ...base, ip: forwardedIp ?? base.ip, outpostAuth };
};

export let assertOutpostConnectionAccess = async (
  c: Context,
  scope: { projectOid: bigint; instanceOid: bigint }
) => {
  let outpostAuth = getOutpostAuth(c);
  if (!outpostAuth) return;

  let granted = await outpostAccessService.isServiceGrantedForInstance({
    outpostId: outpostAuth.outpostId,
    projectOid: scope.projectOid,
    instanceOid: scope.instanceOid,
    service: MCP_CONNECTION_PROXY_SERVICE
  });

  if (!granted) {
    throw new ServiceError(
      forbiddenError({
        message: 'This outpost is not authorized to access this instance'
      })
    );
  }
};
