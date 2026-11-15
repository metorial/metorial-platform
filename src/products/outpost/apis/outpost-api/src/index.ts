import { getSentry } from '@lowerdeck/sentry';
import { createOutpostServer } from '@metorial-outpost/server';
import {
  getOutpostSigningTokens,
  metorialOutpostResolver,
  outpostVerificationTokens
} from '@metorial/module-outpost';
import { outpostChallengeStore } from './challengeStore';

export let outpostApi: any = createOutpostServer({
  resolver: metorialOutpostResolver,
  tokens: outpostVerificationTokens,
  signer: ({ outpostId }) => getOutpostSigningTokens({ outpostId }),
  challengeStore: outpostChallengeStore,
  onError: error => getSentry().captureException(error)
});
