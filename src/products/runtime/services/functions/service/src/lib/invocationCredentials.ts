import { env } from '../env';
import { resolveGrantEgress } from './egressPolicy';
import {
  EGRESS_GRANT_AUDIENCE,
  INVOCATION_TOKEN_AUDIENCE,
  loadRuntimeSigningKey,
  payloadSha256,
  signEgressGrant,
  signInvocationToken,
  type RuntimeSigningKey
} from './runtimeTokens';

let GRANT_EXPIRY_MARGIN_SECONDS = 60;
let INVOCATION_TOKEN_EXPIRY_MARGIN_SECONDS = 30;

let cachedKey: RuntimeSigningKey | undefined;

export let getRuntimeSigningKey = () => {
  let seed = env.runtime.RUNTIME_SIGNING_KEY;
  if (!seed) return undefined;

  cachedKey ??= loadRuntimeSigningKey({ seed, kid: env.runtime.RUNTIME_SIGNING_KEY_ID });
  return cachedKey;
};

let requireRuntimeSigningKey = () => {
  let key = getRuntimeSigningKey();
  if (!key) throw new Error('RUNTIME_SIGNING_KEY is not configured');

  return key;
};

let nowSeconds = () => Math.floor(Date.now() / 1000);

export let mintInvocationGrant = (d: {
  invocationId: string;
  tenantId: string;
  function: { id: string };
  sourceFunction: { id: string };
  functionVersion: { id: string; configuration: PrismaJson.FunctionConfiguration };
  enclave?: { id: string; identifier: string };
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
  source: 'lambda' | 'knative';
  allowAll?: boolean;
}) => {
  let iat = nowSeconds();

  return signEgressGrant(requireRuntimeSigningKey(), {
    iss: 'function-bay',
    aud: EGRESS_GRANT_AUDIENCE,
    jti: d.invocationId,
    tenantId: d.tenantId,
    functionId: d.sourceFunction.id,
    effectiveFunctionId: d.function.id !== d.sourceFunction.id ? d.function.id : undefined,
    functionVersionId: d.functionVersion.id,
    enclaveId: d.enclave?.id,
    enclaveIdentifier: d.enclave?.identifier,
    source: d.source,
    ...resolveGrantEgress({
      configuration: d.functionVersion.configuration,
      egressPolicy: d.egressPolicy,
      allowAll: d.allowAll
    }),
    iat,
    nbf: iat,
    exp: iat + d.functionVersion.configuration.timeoutSeconds + GRANT_EXPIRY_MARGIN_SECONDS
  });
};

export let mintInvocationToken = (d: {
  invocationId: string;
  functionVersionId: string;
  payloadJson: string;
  timeoutSeconds: number;
}) => {
  let iat = nowSeconds();

  return signInvocationToken(requireRuntimeSigningKey(), {
    iss: 'function-bay',
    aud: INVOCATION_TOKEN_AUDIENCE,
    jti: d.invocationId,
    functionVersionId: d.functionVersionId,
    payloadSha256: payloadSha256(d.payloadJson),
    iat,
    exp: iat + d.timeoutSeconds + INVOCATION_TOKEN_EXPIRY_MARGIN_SECONDS
  });
};
