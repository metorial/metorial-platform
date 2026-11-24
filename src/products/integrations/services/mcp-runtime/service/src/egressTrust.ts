import {
  parseTrustTargets,
  startTrustPublisher,
  type TrustPublisher
} from '@metorial-platform-systems/runtime-trust-publisher';
import {
  assertEgressConfigured,
  egressSettings,
  getEgressSigningKey,
  isGatewayEgress
} from '@mtsrc/mcp-runtime-network';

let publisher: TrustPublisher | undefined;

// Gateway mode fails closed: a missing proxy URL or signing key stops startup instead of letting
// the runtime connect to remote servers directly.
export let ensureEgressTrustPublisher = () => {
  if (publisher) return publisher;
  if (!isGatewayEgress()) return undefined;

  assertEgressConfigured();

  let targets = parseTrustTargets(egressSettings.trustConfigMaps ?? []);
  if (!targets.length) return undefined;

  let key = getEgressSigningKey();
  publisher = startTrustPublisher({
    signer: 'mcp-runtime',
    key: { kid: key.kid, publicKey: key.publicKey.toString('base64url') },
    targets
  });

  return publisher;
};
