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

let clearOutpost = async (outpostId: string) => {
  await cachedCredentialLookup.clearByTag(outpostTag(outpostId));
  await cachedInstanceAccessGrant.clearByTag(outpostTag(outpostId));
  await cachedInstanceAuthorization.clearByTag(outpostTag(outpostId));
  await cachedManifest.clearByTag(outpostTag(outpostId));
};

let clearCredential = async (credentialId: string) => {
  await cachedCredentialLookup.clearByTag(outpostCredentialTag(credentialId));
  await cachedInstanceAuthorization.clearByTag(outpostCredentialTag(credentialId));
};

let clearInstance = async (outpostId: string, identifier: string) => {
  await cachedInstanceAuthorization.clearByTag(outpostInstanceTag(outpostId, identifier));
};

export let registerOutpostCacheInvalidation = () => {
  for (let event of [
    'outpost.updated:after',
    'outpost.disabled:after',
    'outpost.enabled:after',
    'outpost.deleted:after'
  ] as const) {
    Fabric.listen(event, async ({ outpost }) => clearOutpost(outpost.id));
  }

  Fabric.listen('outpost_access.updated:after', async ({ outpost }) => {
    await cachedManifest.clearByTag(outpostAccessTag(outpost.id));
    await cachedInstanceAccessGrant.clearByTag(outpostAccessTag(outpost.id));
    await cachedInstanceAuthorization.clearByTag(outpostTag(outpost.id));
  });

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
      cachedVerificationKey.clearByTag(outpostTokenKeyPairTag(keyPair.id))
    );
  }
};
