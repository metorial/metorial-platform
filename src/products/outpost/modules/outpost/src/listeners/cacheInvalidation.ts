import { addAwaitedAfterTransactionHook } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  cachedCredentialLookup,
  cachedInstanceAccessGrant,
  cachedInstanceAuthorization,
  cachedManifest,
  cachedVerificationKey,
  outpostAccessTag,
  outpostCredentialTag,
  outpostInstanceTag,
  outpostTag,
  outpostTokenKeyPairTag
} from '../lib/cache';

type TaggedCache = { clearByTagAndWait: (tag: string) => Promise<void> };

// Clearing before commit would let a concurrent lookup re-cache the old rows for the full TTL.
let clearAfterCommit = (clears: [TaggedCache, string][]) =>
  addAwaitedAfterTransactionHook(async () => {
    for (let [cache, tag] of clears) {
      await cache
        .clearByTagAndWait(tag)
        .catch(error => console.error('Outpost cache invalidation failed', error));
    }
  });

let clearOutpost = (outpostId: string) =>
  clearAfterCommit([
    [cachedCredentialLookup, outpostTag(outpostId)],
    [cachedInstanceAccessGrant, outpostTag(outpostId)],
    [cachedInstanceAuthorization, outpostTag(outpostId)],
    [cachedManifest, outpostTag(outpostId)]
  ]);

let clearCredential = (credentialId: string) =>
  clearAfterCommit([
    [cachedCredentialLookup, outpostCredentialTag(credentialId)],
    [cachedInstanceAuthorization, outpostCredentialTag(credentialId)]
  ]);

let clearInstance = (outpostId: string, identifier: string) =>
  clearAfterCommit([[cachedInstanceAuthorization, outpostInstanceTag(outpostId, identifier)]]);

export let registerOutpostCacheInvalidation = () => {
  for (let event of [
    'outpost.updated:after',
    'outpost.disabled:after',
    'outpost.enabled:after',
    'outpost.deleted:after'
  ] as const) {
    Fabric.listen(event, async ({ outpost }) => clearOutpost(outpost.id));
  }

  Fabric.listen('outpost_access.updated:after', async ({ outpost }) =>
    clearAfterCommit([
      [cachedManifest, outpostAccessTag(outpost.id)],
      [cachedInstanceAccessGrant, outpostAccessTag(outpost.id)],
      [cachedInstanceAuthorization, outpostTag(outpost.id)]
    ])
  );

  Fabric.listen('outpost_credential.created:after', async ({ credential }) =>
    clearCredential(credential.id)
  );

  for (let event of [
    'outpost_credential.disabled:after',
    'outpost_credential.deleted:after',
    'outpost_credential.expired:after'
  ] as const) {
    Fabric.listen(event, async ({ credential }) => clearCredential(credential.id));
  }

  Fabric.listen('outpost_instance.registered:after', async ({ outpost, instance }) =>
    clearInstance(outpost.id, instance.identifier)
  );

  for (let event of [
    'outpost_instance.deactivated:after',
    'outpost_instance.deleted:after'
  ] as const) {
    Fabric.listen(event, async ({ outpost, instance }) =>
      clearInstance(outpost.id, instance.identifier)
    );
  }

  for (let event of [
    'outpost_token_key_pair.replaced:after',
    'outpost_token_key_pair.expired:after'
  ] as const) {
    Fabric.listen(event, async ({ keyPair }) =>
      clearAfterCommit([[cachedVerificationKey, outpostTokenKeyPairTag(keyPair.id)]])
    );
  }
};
