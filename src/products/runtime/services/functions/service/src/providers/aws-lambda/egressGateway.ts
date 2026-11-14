import { env } from '../../env';
import { getRuntimeSigningKey, mintInvocationGrant } from '../../lib/invocationCredentials';

export let getEgressGatewayProxyUrl = () => env.egressGateway.EGRESS_GATEWAY_PROXY_URL;

export let createLambdaEgressCredentials = (
  d: Omit<Parameters<typeof mintInvocationGrant>[0], 'source'>
) => {
  let proxyUrl = getEgressGatewayProxyUrl();
  if (!proxyUrl || !getRuntimeSigningKey()) return undefined;

  return { proxyUrl, token: mintInvocationGrant({ ...d, source: 'lambda' }) };
};
