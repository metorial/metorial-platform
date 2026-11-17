import { redactString } from './redact';

let maxCauseDepth = 5;

export type ErrorKind =
  | 'dns'
  | 'connection_refused'
  | 'connection_reset'
  | 'timeout'
  | 'tls'
  | 'authentication'
  | 'permission'
  | 'not_found'
  | 'limit'
  | 'unavailable'
  | 'invalid_state'
  | 'misconfigured'
  | 'unknown';

export interface ErrorInfo {
  kind: ErrorKind;
  code: string | null;
  message: string;
  hint: string | null;
}

// Mirrors spec/fixtures/error-codes.json; errors.test.ts keeps them equal.
export let errorCodeKinds: Record<string, ErrorKind> = {
  ENOTFOUND: 'dns',
  EAI_AGAIN: 'dns',
  EAI_NONAME: 'dns',

  ECONNREFUSED: 'connection_refused',
  P1001: 'connection_refused',

  ECONNRESET: 'connection_reset',
  EPIPE: 'connection_reset',
  P1017: 'connection_reset',

  ETIMEDOUT: 'timeout',
  ESOCKETTIMEDOUT: 'timeout',
  UND_ERR_CONNECT_TIMEOUT: 'timeout',
  UND_ERR_HEADERS_TIMEOUT: 'timeout',
  TimeoutError: 'timeout',
  RequestTimeout: 'timeout',
  RequestTimeoutException: 'timeout',
  DEADLINE_EXCEEDED: 'timeout',
  P1002: 'timeout',
  P1008: 'timeout',

  CERT_HAS_EXPIRED: 'tls',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'tls',
  SELF_SIGNED_CERT_IN_CHAIN: 'tls',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'tls',
  ERR_TLS_CERT_ALTNAME_INVALID: 'tls',
  P1011: 'tls',

  '28P01': 'authentication',
  '28000': 'authentication',
  P1000: 'authentication',
  NOAUTH: 'authentication',
  WRONGPASS: 'authentication',
  AuthenticationFailed: 'authentication',
  UnrecognizedClientException: 'authentication',
  InvalidClientTokenId: 'authentication',
  InvalidAccessKeyId: 'authentication',
  ExpiredToken: 'authentication',
  ExpiredTokenException: 'authentication',
  InvalidSignatureException: 'authentication',
  SignatureDoesNotMatch: 'authentication',
  UNAUTHENTICATED: 'authentication',
  InvalidAuthenticationInfo: 'authentication',
  NoAuthenticationInformation: 'authentication',

  '42501': 'permission',
  P1010: 'permission',
  AccessDenied: 'permission',
  AccessDeniedException: 'permission',
  AllAccessDisabled: 'permission',
  Unauthorized: 'permission',
  PERMISSION_DENIED: 'permission',
  AuthorizationPermissionMismatch: 'permission',
  AuthorizationFailure: 'permission',
  Forbidden: 'permission',

  '3D000': 'not_found',
  P1003: 'not_found',
  NotFoundException: 'not_found',
  ResourceNotFoundException: 'not_found',
  NoSuchBucket: 'not_found',
  NoSuchKey: 'not_found',
  NOT_FOUND: 'not_found',
  ContainerNotFound: 'not_found',
  BlobNotFound: 'not_found',
  NamespaceNotFound: 'not_found',

  '53300': 'limit',
  P2037: 'limit',
  ThrottlingException: 'limit',
  TooManyRequestsException: 'limit',
  LimitExceededException: 'limit',
  SlowDown: 'limit',
  RESOURCE_EXHAUSTED: 'limit',

  '57P03': 'unavailable',
  CLUSTERDOWN: 'unavailable',
  LOADING: 'unavailable',
  NotWritablePrimary: 'unavailable',
  MongoServerSelectionError: 'unavailable',
  UNAVAILABLE: 'unavailable',
  ServiceUnavailable: 'unavailable',
  ServiceUnavailableException: 'unavailable',
  KeyUnavailableException: 'unavailable',

  KMSInvalidStateException: 'invalid_state',
  DisabledException: 'invalid_state',
  FAILED_PRECONDITION: 'invalid_state',

  PermanentRedirect: 'misconfigured',
  AuthorizationHeaderMalformed: 'misconfigured',
  IllegalLocationConstraintException: 'misconfigured',
  InvalidRegion: 'misconfigured'
};

export let httpStatusKinds: Record<string, ErrorKind> = {
  '401': 'authentication',
  '403': 'permission',
  '404': 'not_found',
  '408': 'timeout',
  '429': 'limit',
  '502': 'unavailable',
  '503': 'unavailable',
  '504': 'timeout'
};

export let errorKindHints: Partial<Record<ErrorKind, string>> = {
  dns: "The hostname could not be resolved. Check the host name and the cluster's DNS.",
  connection_refused:
    'Nothing is listening at that address. Check the host, the port and that the service is running.',
  connection_reset:
    "The connection was closed unexpectedly. Check proxies, TLS settings and the service's logs.",
  timeout:
    'The request timed out. Check network policies, firewalls and security groups between the two.',
  tls: 'The TLS handshake failed. Check the certificate chain, the hostname and any custom CA.',
  authentication: 'The credentials were rejected. Check the username, password, key or token.',
  permission:
    'The credentials are valid but lack permission for this operation. Grant the missing permission.',
  not_found: 'The resource does not exist. Check its name and region, or create it.',
  limit: 'A limit or quota was reached. Raise the limit or reduce the load.',
  unavailable: 'The service is unavailable. Check its health and status.',
  invalid_state:
    'The resource is in a state that does not allow this operation, for example a disabled key.',
  misconfigured:
    'The request reached the service but the configuration does not match it, for example the wrong region or endpoint.'
};

let grpcStatusNames: Record<number, string> = {
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  14: 'UNAVAILABLE',
  16: 'UNAUTHENTICATED'
};

let redisErrorPrefix = /^(NOAUTH|WRONGPASS|CLUSTERDOWN|LOADING)\b/;

let genericErrorNames = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'AggregateError'
]);

export let classifyCode = (code: string | null | undefined): ErrorKind | null =>
  (code && errorCodeKinds[code]) || null;

let codesOf = (err: any): string[] => {
  let codes: string[] = [];
  let add = (value: unknown) => {
    if (typeof value == 'string' && value.length) codes.push(value);
  };

  add(err.Code);
  add(err.codeName);
  add(err.errorCode);
  if (typeof err.code == 'string') add(err.code);
  if (typeof err.code == 'number' && grpcStatusNames[err.code] && err.details !== undefined) {
    add(grpcStatusNames[err.code]);
  }
  if (typeof err.status == 'string') add(err.status);
  if (typeof err.message == 'string') add(redisErrorPrefix.exec(err.message)?.[1]);
  if (typeof err.name == 'string' && !genericErrorNames.has(err.name)) add(err.name);

  return codes;
};

let httpStatusOf = (err: any): number | null => {
  for (let value of [err.$metadata?.httpStatusCode, err.statusCode, err.status]) {
    if (typeof value == 'number' && value >= 100 && value < 600) return value;
  }

  return null;
};

let causesOf = (err: unknown) => {
  let chain: any[] = [];
  let current: any = err;

  while (current && typeof current == 'object' && chain.length <= maxCauseDepth) {
    if (chain.includes(current)) break;
    chain.push(current);

    if (Array.isArray(current.errors) && current.errors.length) chain.push(...current.errors);
    current = current.cause;
  }

  return chain;
};

let messageOf = (err: unknown) => {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err == 'string') return err;

  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
};

let info = (kind: ErrorKind, code: string | null, message: string): ErrorInfo => ({
  kind,
  code,
  message: redactString(message),
  hint: errorKindHints[kind] ?? null
});

export let describeError = (err: unknown): ErrorInfo => {
  let chain = causesOf(err);
  let message = messageOf(err);
  let firstCode: string | null = null;

  for (let item of chain) {
    for (let code of codesOf(item)) {
      firstCode ??= code;

      let kind = classifyCode(code);
      if (kind) return info(kind, code, message);
    }
  }

  for (let item of chain) {
    let status = httpStatusOf(item);
    let kind = status ? httpStatusKinds[String(status)] : undefined;
    if (kind) return info(kind, firstCode ?? `HTTP ${status}`, message);
  }

  for (let item of chain) {
    if (item?.name == 'AbortError' && /timeout|timed out/i.test(String(item.message))) {
      return info('timeout', firstCode, message);
    }
  }

  return info('unknown', firstCode, message);
};
