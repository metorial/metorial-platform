import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let outpostTokenKeyPairResource = resource({
  name: 'outpost_token_key_pair',
  payload: v.typedAny<{
    id: string;
    status: string;
    stopSigningAt: Date;
    stopVerifyingAt: Date;
  }>('outpost_token_key_pair'),
  presenter: undefined,
  actions: {
    create: true,
    replace: true,
    expire: true
  }
});
