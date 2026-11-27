import {
  parseTrustTargets,
  startTrustPublisher,
  type TrustPublisher
} from '@metorial-platform-systems/runtime-trust-publisher';
import { env } from './env';
import { getEgressGateway, isGatewayEgress } from './lib/network/egressGateway';

let publisher: TrustPublisher | undefined;

// Gateway mode fails closed: a missing proxy URL or signing key stops startup instead of letting
// the hub connect to integrations directly.
export let ensureEgressTrustPublisher = () => {
  if (publisher) return publisher;
  if (!isGatewayEgress()) return undefined;

  let { signingKey } = getEgressGateway();

  let targets = parseTrustTargets(env.egress.TRUST_CONFIGMAPS ?? []);
  if (!targets.length) return undefined;

  publisher = startTrustPublisher({
    signer: 'slates-hub',
    key: { kid: signingKey.kid, publicKey: signingKey.publicKey.toString('base64url') },
    targets
  });

  return publisher;
};
