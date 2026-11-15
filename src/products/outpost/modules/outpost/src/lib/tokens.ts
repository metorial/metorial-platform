import { db } from '@metorial/db';
import { base64url, Ed25519 } from '@metorial-outpost/crypto';
import { OutpostTokens } from '@metorial-outpost/tokens';
import { outpostTokenKeyPairService } from '../services/outpostTokenKeyPair';
import { cachedVerificationKey } from './cache';

export let outpostVerificationTokens = new OutpostTokens({
  verification: {
    resolve: async kid => {
      let { publicKey } = await cachedVerificationKey({ kid });
      if (!publicKey) return undefined;

      return await Ed25519.importPublicKey(base64url.decode(publicKey));
    }
  }
});

export let getOutpostSigningTokens = async (d: { outpostId: string }) => {
  let outpost = await db.outpost.findUniqueOrThrow({ where: { id: d.outpostId } });

  return await outpostTokenKeyPairService.getSigningTokens({ outpost });
};
