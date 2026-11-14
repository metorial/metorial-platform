import { resourceSet } from '../../_lib/resource';
import { outpostResource } from './outpost';
import { outpostAccessResource } from './outpostAccess';
import { outpostCredentialResource } from './outpostCredential';
import { outpostInstanceResource } from './outpostInstance';
import { outpostTokenKeyPairResource } from './outpostTokenKeyPair';

export let outpostResources = resourceSet({
  outpost: outpostResource,
  outpost_credential: outpostCredentialResource,
  outpost_access: outpostAccessResource,
  outpost_instance: outpostInstanceResource,
  outpost_token_key_pair: outpostTokenKeyPairResource
});
