import {
  EGRESS_GRANT_AUDIENCE,
  signEgressGrant,
  type EgressGrantClaims,
  type EgressGrantPolicy,
  type RuntimeSigningKey
} from './index';

export let EGRESS_GATEWAY_ERROR_HEADER = 'x-metorial-egress-error';

let PROXY_FAILURE_MESSAGE = /Proxy connection failed/;

export type EgressGrantLifetime = 'request' | 'stream';

export type EgressGatewayRefusal = 'denied' | 'unauthorized';

export type EgressGatewaySubject = {
  tenantId: string;
  enclaveId?: string;
  policy?: EgressGrantPolicy;
};

export type EgressGatewayClientConfig = {
  issuer: EgressGrantClaims['iss'];
  source: EgressGrantClaims['source'];
  proxyUrl: string;
  signingKey: RuntimeSigningKey;
  generateGrantId: () => string;
  ttlSeconds: Record<EgressGrantLifetime, number>;
};

export type EgressGatewayClient = ReturnType<typeof createEgressGatewayClient>;

export let createEgressGatewayClient = (config: EgressGatewayClientConfig) => {
  let mintGrant = (
    subject: EgressGatewaySubject,
    d: { lifetime: EgressGrantLifetime; now?: Date }
  ) => {
    let issuedAt = Math.floor((d.now ?? new Date()).getTime() / 1000);

    return signEgressGrant(config.signingKey, {
      iss: config.issuer,
      aud: EGRESS_GRANT_AUDIENCE,
      jti: config.generateGrantId(),
      tenantId: subject.tenantId,
      enclaveId: subject.enclaveId,
      enclaveIdentifier: subject.enclaveId,
      source: config.source,
      policy: subject.policy,
      iat: issuedAt,
      exp: issuedAt + config.ttlSeconds[d.lifetime]
    });
  };

  let proxyHeaders = (subject: EgressGatewaySubject, lifetime: EgressGrantLifetime) => ({
    'Proxy-Authorization': `Bearer ${mintGrant(subject, { lifetime })}`
  });

  return {
    proxyUrl: config.proxyUrl,
    signingKey: config.signingKey,
    mintGrant,
    proxyHeaders,

    // The `proxy` option of Bun's fetch and WebSocket.
    proxy: (subject: EgressGatewaySubject, lifetime: EgressGrantLifetime) => ({
      url: config.proxyUrl,
      headers: proxyHeaders(subject, lifetime)
    })
  };
};

let parseRefusal = (marker: unknown): EgressGatewayRefusal | null => {
  if (marker === 'denied' || marker === 'unauthorized') return marker;
  return null;
};

// The gateway marks its own refusals, so an upstream 403 or 407 is never mistaken for one.
export let egressGatewayRefusalFromHeaders = (
  headers: Headers | Record<string, unknown>
): EgressGatewayRefusal | null =>
  parseRefusal(
    headers instanceof Headers
      ? headers.get(EGRESS_GATEWAY_ERROR_HEADER)
      : headers[EGRESS_GATEWAY_ERROR_HEADER]
  );

// Bun fails a refused CONNECT (fetch) or proxy handshake (WebSocket) with an error instead of the
// gateway's response, so its status code is only available from the message.
export let egressGatewayRefusalFromError = (error: unknown): EgressGatewayRefusal | null => {
  let { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (typeof message != 'string') return null;

  // fetch reports a refused CONNECT as ERR_PROXY_TUNNEL; WebSocket only has the message.
  let isTunnelFailure = code == 'ERR_PROXY_TUNNEL' || PROXY_FAILURE_MESSAGE.test(message);
  if (!isTunnelFailure) return null;

  if (/\b403\b/.test(message)) return 'denied';
  if (/\b407\b/.test(message)) return 'unauthorized';
  return null;
};
