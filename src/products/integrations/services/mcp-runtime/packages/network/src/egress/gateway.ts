import { ServiceError, badRequestError } from '@lowerdeck/error';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { egressSettings } from '../env';
import {
  EGRESS_GATEWAY_ERROR_HEADER,
  EGRESS_POLICY_BLOCKED_CODE,
  EGRESS_POLICY_BLOCKED_MESSAGE
} from '../network/egressPolicy';
import type { EgressContext } from './context';
import { getEgressSigningKey, mintEgressGrant, type EgressGrantLifetime } from './grant';
import { isGatewayEgress } from './mode';

export let EGRESS_GATEWAY_UNAUTHORIZED_CODE = 'egress_gateway_unauthorized';

let getGatewayProxyUrl = () => {
  let url = egressSettings.gatewayProxyUrl;
  if (!url) {
    throw new Error(
      'SHUTTLE_EGRESS_GATEWAY_PROXY_URL is required when SHUTTLE_EGRESS_MODE is gateway'
    );
  }

  return url;
};

export let assertEgressConfigured = () => {
  if (!isGatewayEgress()) return;

  getGatewayProxyUrl();
  getEgressSigningKey();
};

let proxyAuthorization = (egress: EgressContext, lifetime: EgressGrantLifetime) => ({
  'Proxy-Authorization': `Bearer ${mintEgressGrant(egress, { lifetime })}`
});

export let getGatewayFetchProxy = (egress: EgressContext, lifetime: EgressGrantLifetime) => ({
  url: getGatewayProxyUrl(),
  headers: proxyAuthorization(egress, lifetime)
});

// axios' own `proxy` option sends https requests to the proxy in absolute form, which the
// gateway would relay as plaintext; the agents tunnel https through CONNECT instead.
export let getGatewayAxiosAgents = (egress: EgressContext) => {
  let url = getGatewayProxyUrl();
  let headers = proxyAuthorization(egress, 'request');

  return {
    proxy: false as const,
    httpAgent: new HttpProxyAgent(url, { headers }),
    httpsAgent: new HttpsProxyAgent(url, { headers })
  };
};

let egressPolicyBlockedError = () =>
  new ServiceError(
    badRequestError({
      code: EGRESS_POLICY_BLOCKED_CODE,
      message: EGRESS_POLICY_BLOCKED_MESSAGE
    })
  );

let gatewayUnauthorizedError = () =>
  new ServiceError(
    badRequestError({
      code: EGRESS_GATEWAY_UNAUTHORIZED_CODE,
      message:
        'Metorial Magic Network: the egress gateway rejected the MCP runtime credentials'
    })
  );

let gatewayErrorFromMarker = (marker: string | null | undefined) => {
  if (marker == 'denied') return egressPolicyBlockedError();
  if (marker == 'unauthorized') return gatewayUnauthorizedError();
  return null;
};

export let assertGatewayAccepted = (response: Response) => {
  let error = gatewayErrorFromMarker(response.headers.get(EGRESS_GATEWAY_ERROR_HEADER));
  if (error) throw error;
};

export let assertGatewayAcceptedHeaders = (headers: Record<string, unknown>) => {
  let marker = headers[EGRESS_GATEWAY_ERROR_HEADER];
  let error = gatewayErrorFromMarker(typeof marker == 'string' ? marker : undefined);
  if (error) throw error;
};

// Bun fails a refused CONNECT with ERR_PROXY_TUNNEL instead of returning the proxy's response,
// so the gateway's status code is only available from the message.
export let toGatewayTunnelError = (error: unknown) => {
  let { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (code != 'ERR_PROXY_TUNNEL' || typeof message != 'string') return error;

  if (/\b403\b/.test(message)) return egressPolicyBlockedError();
  if (/\b407\b/.test(message)) return gatewayUnauthorizedError();
  return error;
};
