import {
  parseTrustTargets,
  startTrustPublisher,
  type TrustPublisher
} from '@metorial-platform-systems/runtime-trust-publisher';
import { env } from '../env';
import { loadSigningKey } from './egressGrant';

let publisher: TrustPublisher | undefined;

// Off unless TRUST_CONFIGMAPS is set (Kubernetes installs only); cloud builds run on CodeBuild
// without the egress gateway.
export let ensureTrustPublisher = () => {
  if (publisher) return publisher;

  let targets = parseTrustTargets(env.kubernetes.TRUST_CONFIGMAPS);
  if (!targets.length) return undefined;

  let seed = env.kubernetes.BUILD_SIGNING_KEY;
  if (!seed) throw new Error('TRUST_CONFIGMAPS is set, but BUILD_SIGNING_KEY is not');

  let key = loadSigningKey(seed, env.kubernetes.BUILD_SIGNING_KEY_ID);
  publisher = startTrustPublisher({
    signer: 'build',
    key: { kid: key.kid, publicKey: key.publicKey.toString('base64url') },
    targets
  });
  return publisher;
};
