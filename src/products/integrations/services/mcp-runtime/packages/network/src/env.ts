import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';

export let defaultRequestGrantTtlSeconds = 300;
export let defaultStreamGrantTtlSeconds = 21600;

export let egressSettings = defineSettings('mcpEgress', {
  mode: setting(v.enumOf(['direct', 'gateway']), {
    env: 'SHUTTLE_EGRESS_MODE',
    default: 'gateway',
    editions: ['on-prem'],
    description:
      'How remote MCP servers are reached: "gateway" sends every outbound request through the egress gateway, "direct" connects from the MCP runtime itself'
  }),
  gatewayProxyUrl: setting(v.optional(v.string({ modifiers: [v.url()] })), {
    env: 'SHUTTLE_EGRESS_GATEWAY_PROXY_URL',
    editions: ['on-prem'],
    description: 'HTTP proxy endpoint of the egress gateway, required in gateway mode'
  }),
  signingKey: setting(v.optional(v.string()), {
    env: 'SHUTTLE_EGRESS_SIGNING_KEY',
    secret: true,
    audience: 'derived',
    editions: ['on-prem'],
    description:
      'Base64url Ed25519 seed that signs MCP runtime egress grants, required in gateway mode'
  }),
  signingKeyId: setting(v.optional(v.string()), {
    env: 'SHUTTLE_EGRESS_SIGNING_KEY_ID',
    audience: 'derived',
    editions: ['on-prem'],
    description:
      'Key id for SHUTTLE_EGRESS_SIGNING_KEY, defaults to the id derived from its public key'
  }),
  requestGrantTtlSeconds: setting(
    v.number({ modifiers: [v.integer(), v.minValue(30), v.maxValue(3600)] }),
    {
      env: 'SHUTTLE_EGRESS_REQUEST_GRANT_TTL_SECONDS',
      default: defaultRequestGrantTtlSeconds,
      editions: ['on-prem'],
      description:
        'Lifetime of the grant attached to a single outbound request; the gateway closes the connection when it expires'
    }
  ),
  streamGrantTtlSeconds: setting(
    v.number({ modifiers: [v.integer(), v.minValue(60), v.maxValue(86400)] }),
    {
      env: 'SHUTTLE_EGRESS_STREAM_GRANT_TTL_SECONDS',
      default: defaultStreamGrantTtlSeconds,
      editions: ['on-prem'],
      description:
        'Lifetime of the grant attached to long-lived event streams; the gateway closes the stream when it expires'
    }
  ),
  trustConfigMaps: setting.list(v.string(), {
    env: 'TRUST_CONFIGMAPS',
    default: [],
    editions: ['on-prem'],
    description:
      'Kubernetes ConfigMaps ("namespace/name") the MCP runtime publishes the public key of SHUTTLE_EGRESS_SIGNING_KEY to, for the egress gateway'
  })
});
