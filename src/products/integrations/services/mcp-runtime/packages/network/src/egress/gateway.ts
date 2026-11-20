import { ServiceError, badRequestError } from '@lowerdeck/error';
import {
  egressGatewayRefusalFromError,
  egressGatewayRefusalFromHeaders,
  type EgressGatewayRefusal
} from '@metorial-platform-systems/runtime-egress-grants';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  EGRESS_POLICY_BLOCKED_CODE,
  EGRESS_POLICY_BLOCKED_MESSAGE
} from '../network/egressPolicy';
import type { EgressContext } from './context';
import {
  getEgressGatewayClient,
  getEgressSigningKey,
  getGatewayProxyUrl,
  toEgressSubject,
  type EgressGrantLifetime
} from './grant';
import { isGatewayEgress } from './mode';

export let EGRESS_GATEWAY_UNAUTHORIZED_CODE = 'egress_gateway_unauthorized';

export let assertEgressConfigured = () => {
  if (!isGatewayEgress()) return;

  getGatewayProxyUrl();
  getEgressSigningKey();
};

export let getGatewayFetchProxy = (egress: EgressContext, lifetime: EgressGrantLifetime) =>
  getEgressGatewayClient().proxy(toEgressSubject(egress), lifetime);

// axios' own `proxy` option sends https requests to the proxy in absolute form, which the
// gateway would relay as plaintext; the agents tunnel https through CONNECT instead.
export let getGatewayAxiosAgents = (egress: EgressContext) => {
  let client = getEgressGatewayClient();
  let headers = client.proxyHeaders(toEgressSubject(egress), 'request');

  return {
    proxy: false as const,
    httpAgent: new HttpProxyAgent(client.proxyUrl, { headers }),
    httpsAgent: new HttpsProxyAgent(client.proxyUrl, { headers })
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

let refusalError = (refusal: EgressGatewayRefusal | null) => {
  if (refusal == 'denied') return egressPolicyBlockedError();
  if (refusal == 'unauthorized') return gatewayUnauthorizedError();
  return null;
};

export let assertGatewayAccepted = (response: Response) => {
  let error = refusalError(egressGatewayRefusalFromHeaders(response.headers));
  if (error) throw error;
};

export let assertGatewayAcceptedHeaders = (headers: Record<string, unknown>) => {
  let error = refusalError(egressGatewayRefusalFromHeaders(headers));
  if (error) throw error;
};

export let toGatewayTunnelError = (error: unknown) =>
  refusalError(egressGatewayRefusalFromError(error)) ?? error;
