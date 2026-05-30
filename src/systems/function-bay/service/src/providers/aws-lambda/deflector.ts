import { randomUUID } from 'crypto';
import { SignJWT, type JWTPayload } from 'jose';
import { env } from '../../env';

let jwtSecret =
  env.provider.DEFAULT_PROVIDER == 'aws.lambda' && env.deflector.DEFLECTOR_JWT_SECRET
    ? new TextEncoder().encode(env.deflector.DEFLECTOR_JWT_SECRET)
    : undefined;

let getBaseClaims = () => {
  let now = Math.floor(Date.now() / 1000);
  return {
    aud: env.deflector.DEFLECTOR_JWT_AUDIENCE ?? 'deflector',
    iat: now,
    nbf: now - 30
  };
};

export let createDeflectorToken = async (d: {
  tenantId: string;
  functionId: string;
  effectiveFunctionId?: string;
  functionVersionId: string;
  enclave?: {
    id: string;
    identifier: string;
  };
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
}) => {
  if (!jwtSecret) return undefined;

  let baseClaims = getBaseClaims();
  let payload: JWTPayload & {
    tenantId: string;
    functionId: string;
    effectiveFunctionId?: string;
    functionVersionId: string;
    enclaveId?: string;
    enclaveIdentifier?: string;
    egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
  } = {
    ...baseClaims,
    sub: d.functionVersionId,
    tenantId: d.tenantId,
    functionId: d.functionId,
    effectiveFunctionId: d.effectiveFunctionId,
    functionVersionId: d.functionVersionId,
    enclaveId: d.enclave?.id,
    enclaveIdentifier: d.enclave?.identifier,
    jti: randomUUID(),
    exp: baseClaims.iat + 5 * 60
  };

  if (d.egressPolicy !== undefined) {
    payload.egressPolicy = d.egressPolicy;
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(jwtSecret);
};

export let createLegacyDeflectorToken = async () => {
  if (!jwtSecret) return undefined;

  let baseClaims = getBaseClaims();
  let payload: JWTPayload & {
    legacyFallback: true;
  } = {
    ...baseClaims,
    legacyFallback: true,
    exp: baseClaims.iat + 7 * 24 * 60 * 60
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(jwtSecret);
};

export let getDeflectorProxyUrl = () => env.deflector.DEFLECTOR_PROXY_URL;
