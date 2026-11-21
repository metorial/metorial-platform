import {
  parseTrustTargets,
  startTrustPublisher,
  type TrustPublisher
} from '@metorial-platform-systems/runtime-trust-publisher';
import { env } from '../env';
import { getRuntimeSigningKey } from './invocationCredentials';

let publisher: TrustPublisher | undefined;

// Off unless TRUST_CONFIGMAPS is set (Kubernetes installs only); the cloud passes the public keys
// to the egress gateway through its own configuration.
export let ensureTrustPublisher = () => {
  if (publisher) return publisher;

  let targets = parseTrustTargets(env.runtime.TRUST_CONFIGMAPS);
  if (!targets.length) return undefined;

  let key = getRuntimeSigningKey();
  if (!key) throw new Error('TRUST_CONFIGMAPS is set, but RUNTIME_SIGNING_KEY is not');

  publisher = startTrustPublisher({
    signer: 'functions',
    key: { kid: key.kid, publicKey: key.publicKey.toString('base64url') },
    targets
  });
  return publisher;
};
