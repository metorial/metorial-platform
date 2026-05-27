import { SignJWT, type JWTPayload } from 'jose';
import { env } from '../../env';

let jwtSecret =
  env.provider.DEFAULT_PROVIDER == 'aws.lambda' && env.deflector.DEFLECTOR_JWT_SECRET
    ? new TextEncoder().encode(env.deflector.DEFLECTOR_JWT_SECRET)
    : undefined;

export let createDeflectorToken = async (d: {
  tenantId: string;
  functionId: string;
  effectiveFunctionId?: string;
  functionVersionId: string;
  enclave?: {
    id: string;
    identifier: string;
  };
  egressPolicy?: {
    allowedIps?: string[];
    allowedHosts?: string[];
  };
}) => {
  if (!jwtSecret) return undefined;

  let now = Math.floor(Date.now() / 1000);
  let payload: JWTPayload & {
    tenantId: string;
    functionId: string;
    effectiveFunctionId?: string;
    functionVersionId: string;
    enclaveId?: string;
    enclaveIdentifier?: string;
    allowedIps?: string[];
    allowedHosts?: string[];
  } = {
    aud: env.deflector.DEFLECTOR_JWT_AUDIENCE ?? 'deflector',
    sub: d.functionVersionId,
    tenantId: d.tenantId,
    functionId: d.functionId,
    effectiveFunctionId: d.effectiveFunctionId,
    functionVersionId: d.functionVersionId,
    enclaveId: d.enclave?.id,
    enclaveIdentifier: d.enclave?.identifier,
    iat: now,
    nbf: now - 30,
    exp: now + 5 * 60
  };

  if (d.egressPolicy?.allowedIps !== undefined) {
    payload.allowedIps = d.egressPolicy.allowedIps;
  }
  if (d.egressPolicy?.allowedHosts !== undefined) {
    payload.allowedHosts = d.egressPolicy.allowedHosts;
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(jwtSecret);
};

export let getDeflectorProxyUrl = () => env.deflector.DEFLECTOR_PROXY_URL;
